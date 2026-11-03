/**
 * @file Turn flow: what blocks Next Turn, the end-of-turn checks (dropping
 * to 0 HP → dying or dead; healed → back in the fight), advancing to the
 * next combatant and counting rounds, ending combat, and resetting an
 * encounter.
 */
import type { Encounter } from '../library/types';
import { dropConditionValues } from './conditions';
import { clearedDying, dyingRollName, getBackUp, startDying } from './dying';
import { assignSideInitiative, awaitingInitiative, sortByInitiative, startTurn } from './initiative';
import type { CombatRules } from './rules';
import { inactiveCombat, isInOrder, type Combatant } from './types';
import { findCombatant } from './update';

/** Reasons Next Turn is disabled. Empty means the turn can advance. */
export function nextTurnBlockers(enc: Encounter, rules: CombatRules): string[] {
  if (!enc.combat.active) return ['Combat is not active'];
  if (awaitingInitiative(enc).length > 0) return ['Initiative still needs to be entered'];
  const current = findCombatant(enc, enc.combat.currentId);
  if (!current || !isInOrder(current)) return [];
  const blockers: string[] = [];
  const roll = dyingRollName(rules);
  if (current.status === 'dying' && roll && !current.dyingRollMadeThisTurn) {
    blockers.push(`${current.name} must make a ${roll}`);
  }
  // Only conditions with a per-turn save hold up the turn.
  const unresolved = current.conditions.filter((c) => c.requiresResolve && !c.resolvedThisTurn);
  if (unresolved.length > 0) {
    blockers.push(`Resolve ${unresolved.map((c) => c.name).join(', ')}`);
  }
  return blockers;
}

/**
 * Applied to everyone whenever a turn ends:
 *  - tracked HP at 0 (below 0 for negative-HP rules) → dying or dead
 *  - negative HP at the death threshold → dead
 *  - dying/stable and healed (above 0; 0 or more for negative-HP rules) → back in the fight
 */
export function endOfTurnCheck(c: Combatant, rules: CombatRules): Combatant {
  if (c.currentHp === null || c.status === 'dead') return c;
  const negative = rules.dying.kind === 'negativeHp';
  if (negative && c.currentHp <= -rules.deathThreshold(c.templateId)) return { ...clearedDying(c), status: 'dead' };
  const down = negative ? c.currentHp < 0 : c.currentHp <= 0;
  if (c.status === 'active' && down) return startDying(c, rules);
  if ((c.status === 'dying' || c.status === 'stable') && !down) return getBackUp(c, rules);
  return c;
}

/**
 * Ends the current turn: conditions that drop each turn tick down for the
 * creature whose turn ends, the end-of-turn checks run for everyone, then
 * moves to the next combatant still in the order (adding a round on wrap)
 * and resets their per-turn acknowledgements. In side-initiative formats a
 * new round re-rolls every side and starts with the winner. Does nothing
 * while blocked.
 */
export function nextTurn(enc: Encounter, rules: CombatRules): Encounter {
  if (nextTurnBlockers(enc, rules).length > 0) return enc;
  // The creature whose turn ends first loses a point of conditions like Frightened.
  const checked = enc.combatants.map((c) =>
    endOfTurnCheck(c.id === enc.combat.currentId ? dropConditionValues(c) : c, rules),
  );

  // Walk the full sorted list (including the fallen) so we can find the
  // successor even if the current combatant just left the order.
  const sorted = sortByInitiative(checked.filter((c) => c.initiative !== null), rules);
  const start = sorted.findIndex((c) => c.id === enc.combat.currentId);
  let next: Combatant | undefined;
  let wrapped = false;
  for (let step = 1; step <= sorted.length; step++) {
    const idx = (start + step) % sorted.length;
    if (start + step >= sorted.length) wrapped = true;
    if (isInOrder(sorted[idx])) {
      next = sorted[idx];
      break;
    }
  }

  if (!next) {
    // Nobody left standing; the DM ends combat from here.
    return { ...enc, combatants: checked, combat: { ...enc.combat, currentId: null } };
  }
  const newRound = wrapped && start !== -1;
  let combatants = checked;
  let nextId = next.id;
  if (newRound && rules.initiativeMode === 'sides') {
    combatants = assignSideInitiative({ ...enc, combatants }, rules, true).combatants;
    nextId = sortByInitiative(combatants.filter((c) => isInOrder(c) && c.initiative !== null), rules)[0].id;
  }
  return {
    ...enc,
    combatants: combatants.map((c) => (c.id === nextId ? startTurn(c) : c)),
    combat: {
      ...enc.combat,
      currentId: nextId,
      round: enc.combat.round + (newRound ? 1 : 0),
    },
  };
}

/** Ends combat. Leaves HP, conditions and fallen status as they are; clears initiative. */
export function endCombat(enc: Encounter): Encounter {
  return {
    ...enc,
    combat: inactiveCombat(),
    combatants: enc.combatants.map((c) => ({
      ...c,
      initiative: null,
      dyingRollMadeThisTurn: false,
      conditions: c.conditions.map((x) => ({ ...x, resolvedThisTurn: false })),
    })),
  };
}

/** Back to the prepared state: full HP, no conditions, nobody fallen. */
export function resetEncounter(enc: Encounter): Encounter {
  const ended = endCombat(enc);
  return {
    ...ended,
    combatants: ended.combatants.map((c) => ({
      ...clearedDying(c),
      status: 'active',
      currentHp: c.maxHp,
      tempHp: 0,
      conditions: [],
    })),
  };
}
