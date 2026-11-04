/**
 * @file Settings → AI changes: what AIs changed in the open campaign's
 * notes, newest first, each with Undo.
 */
import { Bot, MessageSquare } from 'lucide-react';
import { useAiChanges } from '../../assistant/history/aiChangeStore';
import { UndoChangeButton } from './UndoChangeButton';
import './aiChanges.css';

/** "just now", "5 min ago", "3 h ago", or the date. */
export function timeAgo(at: number, now = Date.now()): string {
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return new Date(at).toLocaleDateString();
}

export function AiChangesList() {
  const changes = useAiChanges((s) => s.changes);
  return (
    <div className="ai-changes">
      <p className="muted">
        Changes made to this campaign's notes by the Assistant and by AI apps. Undo puts back the pages a change
        touched (and removes pages it made), leaving everything else as it is. The last 100 are kept.
      </p>
      {changes.length === 0 ? (
        <p className="muted">No AI changes yet.</p>
      ) : (
        <ul>
          {[...changes].reverse().map((c) => (
            <li key={c.id} className={c.undoneAt ? 'undone' : undefined}>
              {c.source === 'assistant' ? <MessageSquare size={14} aria-label="Assistant" /> : <Bot size={14} aria-label="AI app" />}
              <span className="ai-change-label">{c.label}</span>
              <span className="muted ai-change-time">{timeAgo(c.at)}</span>
              <UndoChangeButton changeId={c.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
