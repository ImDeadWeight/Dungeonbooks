/**
 * @file Initiative: rolling it for NPCs, entering it for PCs, side
 * initiative (one roll per side each round), sorting the turn order, and
 * starting the first turn once everyone has a value.
 */
import { rollDie } from 'campaign-link/formats/dice';
import type { Id } from '../ids';
import type { Encounter } from '../library/types';
import type { CombatRules } from './rules';
import { isInOrder, type Combatant } from './types';
import { updateCombatant } from './update';

/** Default side names for PCs and NPCs in side-initiative formats. */
export const PARTY_SIDE = 'Party';
export const MONSTER_SIDE = 'Monsters';

/** The side a combatant acts with: as assigned, else Party for PCs and Monsters for NPCs. */
export function sideOf(c: Combatant, rules: CombatRules): string {
  return c.side.trim() || (rules.isPlayerCharacter(c.templateId) ? PARTY_SIDE : MONSTER_SIDE);
}

/** Rolls the die for a new side, re-rolling to avoid values other sides already have (when the die allows). */
function rollNewSide(rules: CombatRules, taken: Set<number>): number {
  let roll = rollDie(rules.initiativeDie);
  for (let tries = 0; taken.has(roll) && taken.size < rules.initiativeDie && tries < 100; tries++) {
    roll = rollDie(rules.initiativeDie);
  }
  taken.add(roll);
  return roll;
}

/**
 * Side initiative: gives combatants without initiative their side's roll,
 * rolling for sides that have none yet. With `fresh`, every side rolls
 * again (start of combat and of each round). Every member of a side shares
 * one value, so the ordinary sort keeps sides together.
 */
export function assignSideInitiative(enc: Encounter, rules: CombatRules, fresh = false): Encounter {
  if (rules.initiativeMode !== 'sides') return enc;
  const rolls = new Map<string, number>();
  if (!fresh) {
    for (const c of enc.combatants) if (c.initiative !== null) rolls.set(sideOf(c, rules), c.initiative);
  }
  const taken = new Set(rolls.values());
  const combatants = enc.combatants.map((c) => {
    if (!fresh && c.initiative !== null) return c;
    const side = sideOf(c, rules);
    if (!rolls.has(side)) rolls.set(side, rollNewSide(rules, taken));
    return { ...c, initiative: rolls.get(side)! };
  });
  return { ...enc, combatants };
}

/** Moves a combatant to another side; during combat it takes that side's roll (rolling one for a new side). */
export function setCombatantSide(enc: Encounter, id: Id, side: string, rules: CombatRules): Encounter {
  const moved = updateCombatant(enc, id, (c) => ({ ...c, side: side.trim(), initiative: null }));
  if (moved === enc) return enc;
  return moved.combat.active ? assignSideInitiative(moved, rules) : moved;
}

/** Highest initiative first; ties go to the higher tiebreak (the format's, e.g. DEX), then to whoever was added first. */
export function sortByInitiative(combatants: Combatant[], rules: CombatRules): Combatant[] {
  return [...combatants].sort((a, b) => {
    const diff = (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity);
    if (diff !== 0) return diff;
    const tie = rules.initiativeTiebreak(b.templateId) - rules.initiativeTiebreak(a.templateId);
    if (tie !== 0) return tie;
    return a.addedOrder - b.addedOrder;
  });
}

/** The live turn order: combatants still fighting who have an initiative. */
export function turnOrder(enc: Encounter, rules: CombatRules): Combatant[] {
  return sortByInitiative(
    enc.combatants.filter((c) => isInOrder(c) && c.initiative !== null),
    rules,
  );
}

/** Combatants in combat still waiting for a manually entered initiative. */
export function awaitingInitiative(enc: Encounter): Combatant[] {
  if (!enc.combat.active) return [];
  return enc.combatants.filter((c) => isInOrder(c) && c.initiative === null);
}

/**
 * Starts combat: NPCs roll the format's die (d20) + modifier, PCs are left
 * blank for the DM to enter. In side-initiative formats every side rolls
 * instead. The first turn begins once every initiative is known.
 */
export function rollForInitiative(enc: Encounter, rules: CombatRules): Encounter {
  if (rules.initiativeMode === 'sides') {
    const started: Encounter = { ...enc, combat: { active: true, round: 0, currentId: null } };
    return beginFirstTurnIfReady(assignSideInitiative(started, rules, true), rules);
  }
  const combatants = enc.combatants.map((c) => {
    if (!isInOrder(c)) return c;
    const initiative = rules.isPlayerCharacter(c.templateId)
      ? null
      : rollDie(rules.initiativeDie) + rules.initiativeModifier(c.templateId);
    return { ...c, initiative };
  });
  return beginFirstTurnIfReady({ ...enc, combatants, combat: { active: true, round: 0, currentId: null } }, rules);
}

/** Applies entered initiative values (combatant id → value) and starts the first turn if everyone is ready. */
export function setInitiative(enc: Encounter, values: Record<string, number>, rules: CombatRules): Encounter {
  const combatants = enc.combatants.map((c) => (c.id in values ? { ...c, initiative: values[c.id] } : c));
  return beginFirstTurnIfReady({ ...enc, combatants }, rules);
}

/** If combat is active, no turn has started, and nobody awaits initiative: round 1, highest initiative goes first. */
function beginFirstTurnIfReady(enc: Encounter, rules: CombatRules): Encounter {
  if (!enc.combat.active || enc.combat.currentId !== null) return enc;
  if (awaitingInitiative(enc).length > 0) return enc;
  const first = turnOrder(enc, rules)[0];
  if (!first) return enc;
  return {
    ...enc,
    combatants: enc.combatants.map((c) => (c.id === first.id ? startTurn(c) : c)),
    combat: { ...enc.combat, round: 1, currentId: first.id },
  };
}

/** Per-turn acknowledgements reset when a combatant's turn begins. */
export function startTurn(c: Combatant): Combatant {
  return {
    ...c,
    dyingRollMadeThisTurn: false,
    conditions: c.conditions.map((cond) => ({ ...cond, resolvedThisTurn: false })),
  };
}
