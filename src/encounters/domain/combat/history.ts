/**
 * @file Undo/redo history for combat, as a pair of snapshot stacks. Each
 * entry stores the whole encounter from before an action, plus a label
 * (shown in the Undo/Redo tooltips).
 */
import type { Encounter } from '../library/types';

/** Maximum undo steps kept per encounter; older ones are dropped. */
export const HISTORY_LIMIT = 200;

/** One undoable step. */
export interface HistoryEntry {
  label: string;
  /** Encounter state before the action was applied. */
  before: Encounter;
}

/** Undo stack (`past`, newest last) and redo stack (`future`, next first). */
export interface History {
  past: HistoryEntry[];
  /** `before` here holds the state to return to on redo. */
  future: HistoryEntry[];
}

/** A history with nothing to undo or redo. */
export function emptyHistory(): History {
  return { past: [], future: [] };
}

/** Adds a step (the state before an action). A new action clears the redo stack. */
export function record(h: History, label: string, before: Encounter): History {
  const past = [...h.past, { label, before }];
  return { past: past.slice(-HISTORY_LIMIT), future: [] };
}

/** Steps back: returns the previous encounter state and the updated history, or null if nothing to undo. */
export function undo(h: History, current: Encounter): { history: History; encounter: Encounter } | null {
  const last = h.past[h.past.length - 1];
  if (!last) return null;
  return {
    history: { past: h.past.slice(0, -1), future: [{ label: last.label, before: current }, ...h.future] },
    encounter: last.before,
  };
}

/** Steps forward again after an undo, or null if nothing to redo. */
export function redo(h: History, current: Encounter): { history: History; encounter: Encounter } | null {
  const [next, ...rest] = h.future;
  if (!next) return null;
  return {
    history: { past: [...h.past, { label: next.label, before: current }], future: rest },
    encounter: next.before,
  };
}
