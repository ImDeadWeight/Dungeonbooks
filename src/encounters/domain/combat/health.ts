/**
 * @file Hit point changes: damage (temp HP absorbs it first), healing
 * (capped at max), and temporary HP. These only change numbers; the 0 HP
 * consequences happen at end of turn in turnFlow.ts.
 */
import type { Id } from '../ids';
import type { Encounter } from '../library/types';
import type { CombatRules } from './rules';
import { updateCombatant } from './update';

/** Lowest HP a combatant can be at: 0, or (negative-HP formats) a bit past the death threshold. */
export const MIN_HP = -100000;

/** Damage drains temp HP first. HP stops at 0 unless the format's dying rules use negative HP. */
export function applyDamage(enc: Encounter, id: Id, amount: number, rules: CombatRules): Encounter {
  if (amount <= 0) return enc;
  const floor = rules.dying.kind === 'negativeHp' ? MIN_HP : 0;
  return updateCombatant(enc, id, (c) => {
    if (c.currentHp === null) return c;
    const absorbed = Math.min(c.tempHp, amount);
    const remaining = amount - absorbed;
    return { ...c, tempHp: c.tempHp - absorbed, currentHp: Math.max(floor, c.currentHp - remaining) };
  });
}

/** Healing is capped at max HP. Status changes (leaving death saves) happen at end of turn. */
export function applyHealing(enc: Encounter, id: Id, amount: number): Encounter {
  if (amount <= 0) return enc;
  return updateCombatant(enc, id, (c) => {
    if (c.currentHp === null || c.maxHp === null) return c;
    return { ...c, currentHp: Math.min(c.maxHp, c.currentHp + amount) };
  });
}

/** Temp HP doesn't stack (5e, PF2e); the new value replaces the old. */
export function setTempHp(enc: Encounter, id: Id, amount: number): Encounter {
  return updateCombatant(enc, id, (c) => ({ ...c, tempHp: Math.max(0, Math.floor(amount)) }));
}
