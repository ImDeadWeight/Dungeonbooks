/**
 * @file The Connect AI button and dialog (desktop app): switches AI
 * connections on or off and gives the setup to paste into Claude Desktop,
 * Claude Code and other apps that speak MCP.
 */
import { Bot, Check, Copy, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  aiConnectionsAvailable,
  newConnectionToken,
  refreshStatus,
  setConnectionsEnabled,
  useAiConnection,
  type ConnectionStatus,
} from '../assistant/connection';
import { Modal } from '../ui/Modal';
import './aiConnect.css';

/** A block of setup text with a copy button. */
function Snippet({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  return (
    <div className="ai-snippet">
      <pre>{text}</pre>
      <button className="icon" title="Copy" onClick={copy}>
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

/** The setup for each kind of app, for this computer. */
function Setup({ status }: { status: ConnectionStatus }) {
  const desktopConfig = JSON.stringify({ mcpServers: { 'dungeon-books': { command: status.executable, args: ['--mcp-stdio'] } } }, null, 2);
  const codeCommand = `claude mcp add --scope user dungeon-books -- "${status.executable}" --mcp-stdio`;
  const url = `http://127.0.0.1:${status.port}/mcp`;
  return (
    <>
      <h3>Claude Desktop</h3>
      <p className="muted">
        In Claude Desktop: Settings → Developer → Edit Config. Add this to the file (merge it into an existing
        "mcpServers" if there is one), save, and restart Claude Desktop. Claude starts Dungeon Books when it needs it.
      </p>
      <Snippet text={desktopConfig} />

      <h3>Claude Code</h3>
      <p className="muted">Run this once in a terminal; every Claude Code session can then use Dungeon Books.</p>
      <Snippet text={codeCommand} />

      <h3>Other apps</h3>
      <p className="muted">
        Apps that connect to an MCP server by address (Streamable HTTP) use this address, sending the token in an
        Authorization header. Dungeon Books must be open.
      </p>
      <Snippet text={`${url}\nAuthorization: Bearer ${status.token}`} />
      <div className="row">
        <span className="spacer muted">A new token stops apps set up by address from connecting until you update them.</span>
        <button onClick={() => void newConnectionToken()}>
          <RefreshCw size={14} /> New token
        </button>
      </div>

      <p className="muted ai-note">
        ChatGPT, and Claude on the web, only connect to servers on the internet, so they can't reach Dungeon Books on
        this computer yet.
      </p>
    </>
  );
}

/** The Connect AI dialog. */
function AiConnectDialog({ close }: { close: () => void }) {
  const status = useAiConnection((s) => s.status);
  useEffect(() => void refreshStatus(), []);

  return (
    <Modal title="Connect AI" size="medium" onClose={close} footer={<button onClick={close}>Done</button>}>
      <div className="ai-connect">
        <p>
          Lets AI apps like Claude work with the open campaign's notes: read and search pages, create pages, add or
          replace text, change pages' details and link mentions. They can't delete pages, and there is no undo for
          their changes.
        </p>
        {status && (
          <>
            <label className="ai-toggle">
              <input type="checkbox" checked={status.enabled} onChange={(e) => void setConnectionsEnabled(e.target.checked)} />
              Let AI apps connect
            </label>
            {status.error ? (
              <p className="ai-error">{status.error}</p>
            ) : (
              <p className="muted">{status.running ? `On: listening on this computer only (port ${status.port}).` : 'Off.'}</p>
            )}
            <Setup status={status} />
          </>
        )}
      </div>
    </Modal>
  );
}

/** Top bar button that opens the dialog (desktop app only). */
export function AiConnectButton() {
  const [open, setOpen] = useState(false);
  const enabled = useAiConnection((s) => s.status?.enabled);
  useEffect(() => {
    if (aiConnectionsAvailable()) void refreshStatus();
  }, []);
  if (!aiConnectionsAvailable()) return null;
  return (
    <>
      <button className={`ai-connect-button${enabled ? ' on' : ''}`} title="Let AI apps like Claude work with your notes" onClick={() => setOpen(true)}>
        <Bot size={16} /> <span className="top-bar-label">Connect AI</span>
      </button>
      {open && <AiConnectDialog close={() => setOpen(false)} />}
    </>
  );
}
