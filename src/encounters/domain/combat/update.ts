/**
 * @file Small immutable helpers for reading and updating one combatant
 * inside an encounter. Every combat action builds on these.
 */
import type { Id } from '../ids';
import type { Encounter } from '../library/types';
import type { Combatant } from './types';

/** Immutable update of one combatant. Unknown ids leave the encounter unchanged. */
export function updateCombatant(enc: Encounter, id: Id, fn: (c: Combatant) => Combatant): Encounter {
  let changed = false;
  const combatants = enc.combatants.map((c) => {
    if (c.id !== id) return c;
    changed = true;
    return fn(c);
  });
  return changed ? { ...enc, combatants } : enc;
}

/** The combatant with this id, or undefined (also for a null id). */
export function findCombatant(enc: Encounter, id: Id | null): Combatant | undefined {
  return id ? enc.combatants.find((c) => c.id === id) : undefined;
}
