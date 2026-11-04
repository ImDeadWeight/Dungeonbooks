/**
 * @file A notice when an AI app changes the notes (those changes happen
 * outside the app's own windows, so they'd otherwise go unseen): what it
 * did, Undo, and a link to the full list. Goes after a while or on dismiss.
 */
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAiChanges } from '../../assistant/history/aiChangeStore';
import { openSettings } from '../settingsDialog';
import { UndoChangeButton } from './UndoChangeButton';
import './aiChanges.css';

/** How long the notice stays (ms). */
const SHOW_FOR_MS = 12000;

export function AiChangeToast() {
  const latest = useAiChanges((s) => s.changes[s.changes.length - 1]);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Re-check when the newest change would expire.
  useEffect(() => {
    if (!latest) return;
    const left = latest.at + SHOW_FOR_MS - Date.now();
    if (left <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), left);
    return () => clearTimeout(timer);
  }, [latest?.id]);

  if (!latest || latest.source !== 'app' || dismissed === latest.id || now - latest.at > SHOW_FOR_MS) return null;
  return (
    <div className="ai-toast" role="status">
      <span className="ai-toast-text">An AI app: {latest.label}</span>
      <UndoChangeButton changeId={latest.id} />
      <button className="ai-toast-all" onClick={() => openSettings('ai-changes')}>
        All changes
      </button>
      <button className="icon" title="Dismiss" onClick={() => setDismissed(latest.id)}>
        <X size={15} />
      </button>
    </div>
  );
}
