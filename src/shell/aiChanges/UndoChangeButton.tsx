/**
 * @file Undo for one AI change. When pages it touched were edited since, it
 * says which and asks before undoing anyway.
 */
import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useAiChanges } from '../../assistant/history/aiChangeStore';
import { undoAiChange } from '../../assistant/history/recordedRun';

const quoted = (titles: string[]) => titles.map((t) => `"${t}"`).join(', ');

/** Undo, "Undone", or nothing (a change no longer in the list). */
export function UndoChangeButton({ changeId }: { changeId: string }) {
  const change = useAiChanges((s) => s.changes.find((c) => c.id === changeId));
  const [edited, setEdited] = useState<string[] | null>(null);
  if (!change) return null;
  if (change.undoneAt) return <span className="ai-undo muted">Undone</span>;

  const undo = (anyway: boolean) => {
    const refusal = undoAiChange(changeId, anyway);
    setEdited(refusal?.reason === 'edited' ? refusal.titles : null);
  };

  if (edited) {
    return (
      <span className="ai-undo ai-undo-confirm">
        <span className="muted">{quoted(edited)} changed since; undoing loses that.</span>
        <button onClick={() => undo(true)}>Undo anyway</button>
        <button onClick={() => setEdited(null)}>Keep</button>
      </span>
    );
  }
  return (
    <button className="ai-undo" title="Put back what this change touched" onClick={() => undo(false)}>
      <Undo2 size={13} /> Undo
    </button>
  );
}
