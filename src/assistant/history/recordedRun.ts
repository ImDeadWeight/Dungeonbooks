/**
 * @file Running a notes tool so its change can be undone: every call an AI
 * makes (in the Assistant tab or from an AI app) goes through here, and
 * undoing one puts back what it touched.
 */
import { newId } from '../../lorekeeper/domain/ids';
import { useNotebook } from '../../lorekeeper/state/notebookStore';
import { describeCall } from '../chat/describeCall';
import type { Tool } from '../notesTools';
import { captureChange, changedSince, undoChange, type AiChangeSource } from './aiChanges';
import { markUndone, recordChange, useAiChanges } from './aiChangeStore';

/** What a call returned, and the change it recorded (none when it only looked, or changed nothing). */
export interface RecordedResult {
  text: string;
  changeId?: string;
}

const contents = () => {
  const { folders, pages } = useNotebook.getState();
  return { folders, pages };
};

/** Runs a tool; when it changes the notes, records the change. Throws what the tool throws. */
export function runRecorded(tool: Tool, args: Record<string, unknown>, source: AiChangeSource): RecordedResult {
  if (tool.readOnly) return { text: tool.run(args) };
  const before = contents();
  const text = tool.run(args);
  const label = describeCall({ id: '', name: tool.name, args, rawArgs: '' });
  const change = captureChange(before, contents(), { id: newId(), at: Date.now(), source, label });
  if (!change) return { text };
  recordChange(change);
  return { text, changeId: change.id };
}

/** Why an undo didn't happen: the change is gone, already undone, or its pages were edited since (titles). */
export type UndoRefusal = { reason: 'missing' } | { reason: 'undone' } | { reason: 'edited'; titles: string[] };

/**
 * Undoes a recorded change. Unless `anyway`, it refuses when pages the
 * change touched were edited since, so those edits aren't lost unasked.
 */
export function undoAiChange(id: string, anyway = false): UndoRefusal | null {
  const change = useAiChanges.getState().changes.find((c) => c.id === id);
  if (!change) return { reason: 'missing' };
  if (change.undoneAt) return { reason: 'undone' };
  const current = contents();
  const edited = changedSince(current, change);
  if (edited.length && !anyway) return { reason: 'edited', titles: edited.map((p) => p.title) };
  useNotebook.setState(undoChange(current, change, newId));
  markUndone(id);
  return null;
}
