/**
 * @file What happens when a combatant drops, for each format's dying rules:
 * going down, the per-turn dying roll (5e death saves, PF2e recovery checks,
 * PF1e stabilization checks), and getting back up.
 */
import type { Id } from '../ids';
import type { Encounter } from '../library/types';
import { conditionValue, raiseConditionValue } from './conditions';
import type { CombatRules } from './rules';
import { noDyingProgress, type Combatant } from './types';
import { updateCombatant } from './update';

/** 5e: successes needed to stabilize, and failures that kill. */
export const DEATH_SAVE_LIMIT = 3;

/** One death save roll's outcome: how many successes and failures to add. */
export interface DeathSaveResult {
  successes: number;
  failures: number;
}

/** What the per-turn dying roll is called in these rules, or null when there is none. */
export function dyingRollName(rules: CombatRules): string | null {
  switch (rules.dying.kind) {
    case 'deathSaves':
      return 'death save';
    case 'dyingValue':
      return 'recovery check';
    case 'negativeHp':
      return 'stabilization check';
    case 'deadAtZero':
      return null;
  }
}

/** The combatant with no dying progress recorded. */
export function clearedDying(c: Combatant): Combatant {
  return { ...c, dying: noDyingProgress(), dyingRollMadeThisTurn: false };
}

/** PF2e: the Dying value that kills, lowered by Doomed. */
function dyingValueLimit(c: Combatant, rules: CombatRules): number {
  return rules.dying.kind === 'dyingValue' ? rules.dying.deathAt - conditionValue(c, rules.dying.doomedId) : Infinity;
}

/**
 * The combatant goes down: dead if they don't use the dying rules (or the
 * format has none), otherwise dying. PF2e starts at Dying 1 plus Wounded,
 * which can be enough to kill outright. `rollMade` marks this turn's roll as
 * done (dropped during their own turn).
 */
export function startDying(c: Combatant, rules: CombatRules, rollMade = false): Combatant {
  if (rules.dying.kind === 'deadAtZero' || !rules.usesDeathSaves(c.templateId)) {
    return { ...clearedDying(c), status: 'dead' };
  }
  const down: Combatant = { ...clearedDying(c), status: 'dying', dyingRollMadeThisTurn: rollMade };
  if (rules.dying.kind !== 'dyingValue') return down;
  const value = 1 + conditionValue(c, rules.dying.wounded.id);
  if (value >= dyingValueLimit(c, rules)) return { ...down, status: 'dead' };
  return { ...down, dying: { ...down.dying, value } };
}

/** PF2e: losing the Dying condition adds 1 to Wounded. */
function woundedAfterDying(c: Combatant, rules: CombatRules): Combatant {
  return rules.dying.kind === 'dyingValue' ? raiseConditionValue(c, rules.dying.wounded, 1) : c;
}

/** Healed while down: back in the fight. Leaving Dying (not Stable) adds Wounded in PF2e. */
export function getBackUp(c: Combatant, rules: CombatRules): Combatant {
  const up: Combatant = { ...clearedDying(c), status: 'active' };
  return c.status === 'dying' ? woundedAfterDying(up, rules) : up;
}

/** Marks this turn's dying roll as made when it's the combatant's own turn. */
function markRoll(enc: Encounter, c: Combatant): Combatant {
  return { ...c, dyingRollMadeThisTurn: c.dyingRollMadeThisTurn || enc.combat.currentId === c.id };
}

/**
 * 5e: records one death save roll (1 or 2 successes for a natural 20 house
 * rule, 1 or 2 failures for a natural 1). Three of either ends the dying
 * state. Failures are checked first: a single roll can't do both.
 */
export function recordDeathSave(enc: Encounter, id: Id, result: DeathSaveResult): Encounter {
  return updateCombatant(enc, id, (c) => {
    if (c.status !== 'dying') return c;
    const dying = {
      ...c.dying,
      successes: Math.min(DEATH_SAVE_LIMIT, c.dying.successes + result.successes),
      failures: Math.min(DEATH_SAVE_LIMIT, c.dying.failures + result.failures),
    };
    const next = markRoll(enc, { ...c, dying });
    if (dying.failures >= DEATH_SAVE_LIMIT) return { ...next, status: 'dead' };
    if (dying.successes >= DEATH_SAVE_LIMIT) return { ...next, status: 'stable' };
    return next;
  });
}

/**
 * PF2e: a recovery check changes Dying by `change` (critical success −2,
 * success −1, failure +1, critical failure +2). Reaching the limit kills;
 * reaching 0 leaves them stable (unconscious at 0 HP) with Wounded raised.
 */
export function recordRecoveryCheck(enc: Encounter, id: Id, change: number, rules: CombatRules): Encounter {
  return updateCombatant(enc, id, (c) => {
    if (c.status !== 'dying' || rules.dying.kind !== 'dyingValue') return c;
    const value = Math.max(0, c.dying.value + change);
    const next = markRoll(enc, { ...c, dying: { ...c.dying, value } });
    if (value >= dyingValueLimit(c, rules)) return { ...next, status: 'dead' };
    if (value === 0) return woundedAfterDying({ ...next, status: 'stable' }, rules);
    return next;
  });
}

/**
 * PF1e: a stabilization check. Success stabilizes; failure loses 1 HP
 * (when tracked), which kills at the death threshold.
 */
export function recordStabilizationCheck(enc: Encounter, id: Id, success: boolean, rules: CombatRules): Encounter {
  return updateCombatant(enc, id, (c) => {
    if (c.status !== 'dying' || rules.dying.kind !== 'negativeHp') return c;
    const next = markRoll(enc, c);
    if (success) return { ...next, status: 'stable' };
    if (c.currentHp === null) return next;
    const currentHp = c.currentHp - 1;
    return { ...next, currentHp, status: currentHp <= -rules.deathThreshold(c.templateId) ? 'dead' : 'dying' };
  });
}
