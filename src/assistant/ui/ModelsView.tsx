/**
 * @file The Models screen: model servers already connected, the ones found
 * on this computer and the local network (with a Connect button each,
 * signing in to Redstart where it asks), adding one by address, and the
 * Anthropic and OpenAI API keys.
 */
import { ArrowLeft, Check, Loader, Plug, RefreshCw, Trash2, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isMobile } from '../../platform';
import { API_BASE_URLS, redstartNeedsSignIn, signInToRedstart, useAssistantSettings } from '../chat/settings';
import { listModels } from '../models/clients';
import { detectLocal, detectNetwork, type FoundServer } from '../models/detect';
import type { Connection, ConnectionKind } from '../models/types';

/** Connects, then picks the server's first model unless one was chosen before. */
async function connectTo(fields: Omit<Connection, 'id'>): Promise<Connection> {
  const connection = useAssistantSettings.getState().connect(fields);
  if (!connection.model) {
    const [first] = await listModels(connection);
    if (first) useAssistantSettings.getState().use(connection.id, first);
  }
  return connection;
}

/** Redstart's sign-in: an account's name and password, or an API key instead. */
function RedstartSignIn({ server, onDone }: { server: FoundServer; onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = apiKey.trim() || (await signInToRedstart(server.baseUrl, username.trim(), password));
      await connectTo({ kind: 'redstart', name: server.name, baseUrl: server.baseUrl, apiKey: token });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="assistant-signin">
      <input placeholder="User name" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      <span className="muted">or</span>
      <input placeholder="API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      <button className="primary" disabled={busy || (!apiKey.trim() && (!username.trim() || !password))} onClick={() => void submit()}>
        Sign in
      </button>
      {error && <p className="assistant-error">{error}</p>}
    </div>
  );
}

/** A found server with its Connect button. */
function FoundRow({ server }: { server: FoundServer }) {
  const connected = useAssistantSettings((s) => s.connections.some((c) => c.baseUrl === server.baseUrl && c.kind === server.kind));
  const [signingIn, setSigningIn] = useState(false);
  const noModel = server.kind === 'redstart' && server.name.endsWith('(no model running)');
  const connect = () => {
    if (server.needsSignIn && server.kind === 'redstart') setSigningIn(true);
    else void connectTo({ kind: server.kind, name: server.name, baseUrl: server.baseUrl });
  };
  return (
    <div className="assistant-server">
      <div className="assistant-server-row">
        <div className="assistant-server-name">
          <strong>{server.name}</strong>
          <span className="muted">
            {server.baseUrl}
            {server.models.length > 0 && ` · ${server.models.length} model${server.models.length === 1 ? '' : 's'}`}
            {server.needsSignIn && ' · needs sign-in'}
          </span>
        </div>
        {connected ? (
          <span className="assistant-connected">
            <Check size={14} /> Connected
          </span>
        ) : (
          <button className="primary" onClick={connect} disabled={noModel} title={noModel ? 'Start a model in Redstart Nest first' : undefined}>
            <Plug size={14} /> Connect
          </button>
        )}
      </div>
      {signingIn && !connected && <RedstartSignIn server={server} onDone={() => setSigningIn(false)} />}
    </div>
  );
}

/** A list of found servers, or what to say when there are none. */
function FoundList({ servers, busy, none }: { servers: FoundServer[] | null; busy: boolean; none: string }) {
  if (busy && !servers?.length) {
    return (
      <p className="muted assistant-searching">
        <Loader size={14} className="spin" /> Looking…
      </p>
    );
  }
  if (!servers) return null;
  if (!servers.length) return <p className="muted">{none}</p>;
  return (
    <>
      {servers.map((s) => (
        <FoundRow key={`${s.kind}:${s.baseUrl}`} server={s} />
      ))}
    </>
  );
}

/** Connecting a server by its address. */
function AddByAddress() {
  const [kind, setKind] = useState<ConnectionKind>('openai-compatible');
  const [address, setAddress] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState<FoundServer | null>(null);

  const add = async () => {
    setError(null);
    let baseUrl = address.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
    if (!/^https?:\/\//.test(baseUrl)) baseUrl = `http://${baseUrl}`;
    const name = `${kind === 'redstart' ? 'Redstart' : 'Server'} at ${baseUrl.replace(/^https?:\/\//, '')}`;
    if (kind === 'redstart' && !key.trim() && (await redstartNeedsSignIn(baseUrl))) {
      setServer({ kind, name, baseUrl, models: [], needsSignIn: true });
      return;
    }
    const connection = await connectTo({ kind, name, baseUrl, apiKey: key.trim() || undefined });
    if (!(await listModels(connection)).length) setError(`Connected, but ${baseUrl} didn't list any models. Check the address (and key).`);
    setAddress('');
    setKey('');
  };

  return (
    <div className="assistant-form">
      <div className="assistant-form-row">
        <select value={kind} onChange={(e) => setKind(e.target.value as ConnectionKind)}>
          <option value="openai-compatible">OpenAI-style server</option>
          <option value="redstart">Redstart Nest</option>
        </select>
        <input placeholder="Address, e.g. 192.168.1.20:11434" value={address} onChange={(e) => setAddress(e.target.value)} />
        <input placeholder="Key (if it needs one)" value={key} onChange={(e) => setKey(e.target.value)} />
        <button disabled={!address.trim()} onClick={() => void add()}>
          Connect
        </button>
      </div>
      {server && <RedstartSignIn server={server} onDone={() => setServer(null)} />}
      {error && <p className="assistant-error">{error}</p>}
    </div>
  );
}

/** An Anthropic or OpenAI API key. */
function ApiKeyRow({ kind, label, hint }: { kind: 'anthropic' | 'openai'; label: string; hint: string }) {
  const existing = useAssistantSettings((s) => s.connections.find((c) => c.kind === kind));
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setError(null);
    const connection = await connectTo({ kind, name: label, baseUrl: API_BASE_URLS[kind]!, apiKey: key.trim() });
    if (!(await listModels(connection)).length) {
      useAssistantSettings.getState().remove(connection.id);
      setError(`${label} didn't accept that key (or couldn't be reached).`);
      return;
    }
    setKey('');
  };
  return (
    <div className="assistant-form-row">
      <strong className="assistant-key-label">{label}</strong>
      <input type="password" placeholder={existing ? 'Key saved; paste a new one to replace it' : hint} value={key} onChange={(e) => setKey(e.target.value)} />
      <button disabled={!key.trim()} onClick={() => void save()}>
        Save key
      </button>
      {error && <p className="assistant-error">{error}</p>}
    </div>
  );
}

/** The Models screen. */
export function ModelsView({ done, back }: { done: () => void; back?: () => void }) {
  const connections = useAssistantSettings((s) => s.connections);
  const [local, setLocal] = useState<FoundServer[] | null>(null);
  const [network, setNetwork] = useState<FoundServer[] | null>(null);
  const [busy, setBusy] = useState<'local' | 'network' | null>(null);

  const searchLocal = async () => {
    setBusy('local');
    setLocal(await detectLocal());
    setBusy(null);
  };
  const searchNetwork = async () => {
    setBusy('network');
    setNetwork(await detectNetwork());
    setBusy(null);
  };
  // Look on this computer straight away; a phone has no runners of its own, so it looks around the network instead.
  useEffect(() => {
    void (isMobile() ? searchNetwork() : searchLocal());
  }, []);

  return (
    <div className="assistant-models">
      <div className="assistant-chat-header">
        {back && (
          <button className="icon" onClick={back} title="Chats">
            <ArrowLeft size={18} />
          </button>
        )}
        <h2>Models</h2>
        <span className="spacer" />
        {connections.length > 0 && (
          <button className="primary" onClick={done}>
            Back to chat
          </button>
        )}
      </div>

      <div className="assistant-models-body">
        {connections.length > 0 && (
          <section>
            <h3>Connected</h3>
            {connections.map((c) => (
              <div key={c.id} className="assistant-server-row">
                <div className="assistant-server-name">
                  <strong>{c.name}</strong>
                  <span className="muted">
                    {c.baseUrl}
                    {c.model && ` · ${c.model}`}
                  </span>
                </div>
                <button className="icon" title="Remove" onClick={() => useAssistantSettings.getState().remove(c.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </section>
        )}

        {!isMobile() && (
          <section>
            <div className="assistant-section-head">
              <h3>On this computer</h3>
              <button className="icon" title="Look again" onClick={() => void searchLocal()} disabled={busy !== null}>
                <RefreshCw size={15} />
              </button>
            </div>
            <FoundList
              servers={local}
              busy={busy === 'local'}
              none="No model servers found. Start Ollama, LM Studio, Jan, llama.cpp's server or Redstart Nest, then look again."
            />
          </section>
        )}

        <section>
          <div className="assistant-section-head">
            <h3>On your network</h3>
            <button onClick={() => void searchNetwork()} disabled={busy !== null}>
              <Wifi size={15} /> {network ? 'Search again' : 'Search the network'}
            </button>
          </div>
          <p className="muted">
            Finds Redstart Nest, and Ollama or LM Studio when they are set to serve on the network, on other computers on this Wi-Fi.
          </p>
          <FoundList servers={network} busy={busy === 'network'} none="Nothing found on the network. You can still add a server by its address below." />
        </section>

        <section>
          <h3>Add by address</h3>
          <AddByAddress />
        </section>

        <section>
          <h3>API keys</h3>
          <p className="muted">
            Use Claude or GPT models through their companies' APIs. These are paid per use and separate from a Claude or ChatGPT subscription; the
            key is kept on this device.
          </p>
          <ApiKeyRow kind="anthropic" label="Anthropic (Claude)" hint="sk-ant-…" />
          <ApiKeyRow kind="openai" label="OpenAI (GPT)" hint="sk-…" />
        </section>
      </div>
    </div>
  );
}
