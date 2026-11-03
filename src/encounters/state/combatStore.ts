/**
 * @file The single entry point for changing an encounter's combatants or
 * combat state. Runs pure combat actions against the library store, records
 * undo/redo history while combat is active, and auto-selects whoever's turn
 * it becomes.
 */
import { create } from 'zustand';
import * as hist from '../domain/combat/history';
import { combatRulesFrom, type CombatRules } from '../domain/combat/rules';
import type { Id } from '../domain/ids';
import type { Encounter } from '../domain/library/types';
import { useCharacters } from './characterStore';
import { useLibrary } from './libraryStore';
import { useUi } from './uiStore';

/**
 * Undo/redo for active combat. Every combat action goes through
 * runCombatAction, which snapshots the encounter first. History is per
 * encounter and kept in memory for the session; switching encounters keeps
 * each one's history intact.
 */
interface CombatHistoryState {
  /** History per encounter id. */
  histories: Record<Id, hist.History>;
  /** Empties an encounter's undo and redo stacks. */
  clear(encounterId: Id): void;
  /** Stores an encounter's updated history. */
  setHistory(encounterId: Id, h: hist.History): void;
}

/** The combat history store hook. */
export const useCombatHistory = create<CombatHistoryState>((set) => ({
  histories: {},
  clear: (id) => set((s) => ({ histories: { ...s.histories, [id]: hist.emptyHistory() } })),
  setHistory: (id, h) => set((s) => ({ histories: { ...s.histories, [id]: h } })),
}));

/** Combat rules for the encounter's format, backed by the current character templates. */
export function currentRules(enc: Encounter): CombatRules {
  const { templates } = useCharacters.getState();
  return combatRulesFrom(enc.formatId, (id) => templates.find((t) => t.id === id));
}

/** The encounter with this id from the library store, if it exists. */
function getEncounter(id: Id): Encounter | undefined {
  return useLibrary.getState().encounters.find((e) => e.id === id);
}

/** Saves the new encounter state. Whenever the turn changes (including via undo), selects whoever's turn it now is. */
function commit(prev: Encounter, next: Encounter) {
  useLibrary.getState().replaceEncounter(next);
  if (next.combat.currentId && next.combat.currentId !== prev.combat.currentId) {
    useUi.getState().selectCombatant(next.id, next.combat.currentId);
  }
}

/** A pure function from one encounter state to the next (see domain/combat). */
export type CombatAction = (enc: Encounter, rules: CombatRules) => Encounter;

/** Applies an action. Recorded for undo only while combat is active; no-ops aren't recorded. */
export function runCombatAction(encounterId: Id, label: string, action: CombatAction) {
  const enc = getEncounter(encounterId);
  if (!enc) return;
  const next = action(enc, currentRules(enc));
  if (next === enc) return;
  if (enc.combat.active) {
    const store = useCombatHistory.getState();
    store.setHistory(encounterId, hist.record(store.histories[encounterId] ?? hist.emptyHistory(), label, enc));
  }
  commit(enc, next);
}

/** Starting or ending combat resets history: undo never crosses those boundaries. */
export function runCombatBoundary(encounterId: Id, action: CombatAction) {
  const enc = getEncounter(encounterId);
  if (!enc) return;
  useCombatHistory.getState().clear(encounterId);
  commit(enc, action(enc, currentRules(enc)));
}

/** Undoes the encounter's last combat action. */
export function undoCombat(encounterId: Id) {
  stepHistory(encounterId, hist.undo);
}

/** Re-applies the encounter's last undone action. */
export function redoCombat(encounterId: Id) {
  stepHistory(encounterId, hist.redo);
}

/** Shared undo/redo: moves one step through history and saves the resulting state. */
function stepHistory(encounterId: Id, step: typeof hist.undo) {
  const enc = getEncounter(encounterId);
  const store = useCombatHistory.getState();
  const h = store.histories[encounterId];
  if (!enc || !h) return;
  const result = step(h, enc);
  if (!result) return;
  store.setHistory(encounterId, result.history);
  commit(enc, result.encounter);
}

/** React hook: labels of the next undo and redo steps (null when there's none), for tooltips. */
export function useHistoryLabels(encounterId: Id) {
  const h = useCombatHistory((s) => s.histories[encounterId]);
  return {
    undoLabel: h?.past[h.past.length - 1]?.label ?? null,
    redoLabel: h?.future[0]?.label ?? null,
  };
}
