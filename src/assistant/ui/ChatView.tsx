/**
 * @file The open chat: which model answers, the messages (with what the
 * model looked at and changed), a change waiting for Allow or Skip, and the
 * box to write in.
 */
import { ArrowLeft, Check, ChevronRight, Pencil, Search, Send, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useActiveCampaign } from '../../campaigns/campaignStore';
import { sendMessage, stopAnswer } from '../chat/agent';
import { useChats, type Chat } from '../chat/chats';
import { changeDetails, describeCall } from '../chat/describeCall';
import { useAssistantSettings } from '../chat/settings';
import { listModels } from '../models/clients';
import type { ChatMessage, ToolCall, ToolResult } from '../models/types';
import { NOTES_TOOLS } from '../notesTools';
import { MarkdownText } from './MarkdownText';

const isChange = (call: ToolCall) => !NOTES_TOOLS.find((t) => t.name === call.name)?.readOnly;

/** The connection and model pickers. */
function ModelPicker({ showModels }: { showModels: () => void }) {
  const { connections, currentId } = useAssistantSettings();
  const current = connections.find((c) => c.id === currentId);
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    setModels([]);
    if (!current) return;
    let live = true;
    void listModels(current).then((list) => {
      if (!live) return;
      setModels(list);
      if (!current.model && list[0]) useAssistantSettings.getState().use(current.id, list[0]);
    });
    return () => {
      live = false;
    };
  }, [current?.id, current?.baseUrl, current?.apiKey]);

  if (!current) {
    return (
      <button className="primary" onClick={showModels}>
        Connect a model…
      </button>
    );
  }
  const options = current.model && !models.includes(current.model) ? [current.model, ...models] : models;
  return (
    <div className="assistant-picker">
      <select value={current.id} onChange={(e) => useAssistantSettings.getState().use(e.target.value)} title="Model server">
        {connections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select value={current.model ?? ''} onChange={(e) => useAssistantSettings.getState().use(current.id, e.target.value)} title="Model">
        {!current.model && <option value="">Choose a model</option>}
        {options.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}

/** One tool call: what it did, opening to show what came back. */
function CallLine({ call, result }: { call: ToolCall; result?: ToolResult }) {
  const [open, setOpen] = useState(false);
  const Icon = isChange(call) ? Pencil : Search;
  const state = !result ? 'waiting' : result.isError ? 'failed' : 'done';
  return (
    <div className={`assistant-call ${state}`}>
      <button className="assistant-call-line" onClick={() => setOpen(!open)} disabled={!result}>
        <Icon size={13} />
        <span>{describeCall(call)}</span>
        {result && (result.isError ? <X size={13} /> : <Check size={13} />)}
        {result && <ChevronRight size={13} className={open ? 'open' : undefined} />}
      </button>
      {open && result && <pre className="assistant-call-result">{result.text}</pre>}
    </div>
  );
}

/** The messages, with each tool call shown next to its result. */
function Messages({ chat }: { chat: Chat }) {
  const results = new Map<string, ToolResult>();
  for (const m of chat.messages) if (m.role === 'tool') for (const r of m.results) results.set(r.callId, r);
  const shown = chat.messages.filter((m): m is Exclude<ChatMessage, { role: 'tool' }> => m.role !== 'tool');
  return (
    <>
      {shown.map((m, i) =>
        m.role === 'user' ? (
          <div key={i} className="assistant-message user">
            {m.text}
          </div>
        ) : (
          <div key={i} className="assistant-message model">
            {m.text && <MarkdownText text={m.text} campaignId={chat.campaignId} />}
            {m.toolCalls.map((call) => (
              <CallLine key={call.id} call={call} result={results.get(call.id)} />
            ))}
          </div>
        ),
      )}
    </>
  );
}

/** A change the model wants to make, with Allow and Skip. */
function PendingCard({ chat }: { chat: Chat }) {
  const pending = useChats((s) => (s.pending?.chatId === chat.id ? s.pending : null));
  if (!pending) return null;
  const { text, fields } = changeDetails(pending.call);
  return (
    <div className="assistant-pending">
      <div className="assistant-pending-title">
        <Pencil size={14} /> {describeCall(pending.call)}?
      </div>
      {fields.length > 0 && (
        <dl>
          {fields.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {text && <pre className="assistant-pending-text">{text}</pre>}
      <div className="assistant-pending-actions">
        <label>
          <input type="checkbox" checked={!!chat.allowChanges} onChange={(e) => useChats.getState().update(chat.id, { allowChanges: e.target.checked })} />
          Don't ask again in this chat
        </label>
        <span className="spacer" />
        <button onClick={() => pending.decide(false)}>Skip</button>
        <button className="primary" onClick={() => pending.decide(true)}>
          Allow
        </button>
      </div>
    </div>
  );
}

/** The writing box: Enter sends, Shift+Enter starts a new line. */
function Composer({ chat }: { chat: Chat }) {
  const [text, setText] = useState('');
  const running = useChats((s) => s.runningChatId !== null);
  const runningHere = useChats((s) => s.runningChatId === chat.id);
  const send = () => {
    if (!text.trim() || running) return;
    void sendMessage(chat.id, text.trim());
    setText('');
  };
  return (
    <div className="assistant-composer">
      <textarea
        value={text}
        placeholder="Ask about your notes, or ask for changes…"
        rows={2}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      {runningHere ? (
        <button onClick={stopAnswer} title="Stop">
          <Square size={16} />
        </button>
      ) : (
        <button className="primary" onClick={send} disabled={!text.trim() || running} title="Send">
          <Send size={16} />
        </button>
      )}
    </div>
  );
}

/** The open chat, or a start screen. */
export function ChatView({ back, showModels }: { back?: () => void; showModels: () => void }) {
  const campaign = useActiveCampaign();
  const chat = useChats((s) => s.chats.find((c) => c.id === s.openChatId && c.campaignId === campaign?.id));
  // While a change waits for the user the model isn't working, so no "Thinking…".
  const streaming = useChats((s) => (chat && s.runningChatId === chat.id && !s.pending ? s.streamingText : null));
  const error = useChats((s) => s.error);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Braces matter: newer browsers' scrollIntoView returns a promise, which React would take for a clean-up.
    void end.current?.scrollIntoView({ block: 'end' });
  }, [chat?.messages.length, streaming]);

  return (
    <div className="assistant-chat">
      <div className="assistant-chat-header">
        {back && (
          <button className="icon" onClick={back} title="Chats">
            <ArrowLeft size={18} />
          </button>
        )}
        <ModelPicker showModels={showModels} />
      </div>
      <div className="assistant-chat-body">
        {!chat ? (
          <p className="muted assistant-empty">
            Start a new chat to ask about {campaign ? `"${campaign.name}"` : 'your campaign'}'s notes: summaries, ideas, finding things, or
            changes like new pages and added text. You'll be asked before anything changes.
          </p>
        ) : (
          <>
            <Messages chat={chat} />
            {streaming !== null && (
              <div className="assistant-message model">
                {streaming ? (
                  <MarkdownText text={streaming} campaignId={chat.campaignId} />
                ) : (
                  <div className="assistant-text">
                    <span className="assistant-thinking">Thinking…</span>
                  </div>
                )}
              </div>
            )}
            <PendingCard chat={chat} />
            {error && <p className="assistant-error">{error}</p>}
          </>
        )}
        <div ref={end} />
      </div>
      {chat && <Composer chat={chat} />}
    </div>
  );
}
