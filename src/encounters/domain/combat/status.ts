/**
 * @file Manual status changes: Drop/Revive for combatants whose HP isn't
 * tracked, restoring the killed or stabilized, and removing combatants from
 * an encounter outside combat.
 */
import type { Id } from '../ids';
import type { Encounter } from '../library/types';
import { clearedDying, getBackUp, startDying } from './dying';
import type { CombatRules } from './rules';
import { updateCombatant } from './update';

/** Whether the app tracks this combatant's HP (false = the player tracks it). */
export function hasTrackedHp(c: { currentHp: number | null }): boolean {
  return c.currentHp !== null;
}

/**
 * Untracked HP (e.g. a PC without a stat block, whose player tracks HP):
 * the DM drops them manually. Takes effect immediately rather than at end of
 * turn, since the DM already knows they're down. Dropping on their own turn
 * doesn't demand a dying roll that same turn.
 */
export function dropCombatant(enc: Encounter, id: Id, rules: CombatRules): Encounter {
  return updateCombatant(enc, id, (c) =>
    hasTrackedHp(c) || c.status !== 'active' ? c : startDying(c, rules, enc.combat.currentId === c.id),
  );
}

/** Untracked HP counterpart of "healed while dying": back in the fight immediately. */
export function reviveCombatant(enc: Encounter, id: Id, rules: CombatRules): Encounter {
  return updateCombatant(enc, id, (c) => (c.status === 'dying' && !hasTrackedHp(c) ? getBackUp(c, rules) : c));
}

/**
 * Brings a killed or stabilized combatant back into the initiative order.
 * Tracked HP is raised to at least 1 so they don't drop again at end of turn.
 */
export function restoreCombatant(enc: Encounter, id: Id): Encounter {
  return updateCombatant(enc, id, (c) => {
    if (c.status !== 'dead' && c.status !== 'stable') return c;
    const currentHp = c.currentHp === null ? null : Math.max(1, c.currentHp);
    return { ...clearedDying(c), status: 'active', currentHp };
  });
}

/** Only allowed outside active combat (enforced by the caller's UI and here). */
export function removeCombatant(enc: Encounter, id: Id): Encounter {
  if (enc.combat.active) return enc;
  return { ...enc, combatants: enc.combatants.filter((c) => c.id !== id) };
}
