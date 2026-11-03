/**
 * @file Tests for the combat engine: initiative, turn flow and rounds, 0 HP
 * outcomes for each format's dying rules (5e death saves, PF2e Dying value,
 * PF1e negative HP, B/X dead at 0), Drop/Revive, valued conditions, and
 * which conditions block Next Turn.
 */
import { describe, expect, it } from 'vitest';
import type { Encounter } from '../library/types';
import type { ConditionDef } from '../conditions';
import type { DyingRules } from 'campaign-link/formats/formatTypes';
import { addCondition, conditionValue, resolveCondition, setConditionValue, setRequiresResolve } from './conditions';
import { recordDeathSave, recordRecoveryCheck, recordStabilizationCheck } from './dying';
import { applyDamage, applyHealing } from './health';
import { awaitingInitiative, rollForInitiative, setInitiative, turnOrder } from './initiative';
import type { CombatRules } from './rules';
import { dropCombatant, reviveCombatant } from './status';
import { nextTurn, nextTurnBlockers } from './turnFlow';
import { inactiveCombat, noDyingProgress, type Combatant } from './types';

/** Template ids treated as PCs (death saves, manual initiative). */
const PCS = new Set(['pc', 'pc-untracked']);
/** Fixed rules: no initiative modifiers, all tiebreaks equal, death threshold 10; 5e death saves unless given. */
function rulesWith(dying: DyingRules = { kind: 'deathSaves' }): CombatRules {
  return {
    initiativeMode: 'individual',
    initiativeDie: 20,
    dying,
    usesDeathSaves: (id) => PCS.has(id),
    isPlayerCharacter: (id) => PCS.has(id),
    initiativeModifier: () => 0,
    initiativeTiebreak: () => 10,
    deathThreshold: () => 10,
  };
}
/** 5e rules. */
const rules = rulesWith();

/** A fresh combatant at full HP (null = untracked HP). */
function combatant(id: string, templateId: string, hp: number | null, order: number): Combatant {
  return {
    id, templateId, name: id, maxHp: hp, currentHp: hp, tempHp: 0, initiative: null,
    addedOrder: order, tokenDescription: '', side: '', conditions: [], status: 'active',
    dying: noDyingProgress(), dyingRollMadeThisTurn: false,
  };
}

/** An encounter outside combat containing these combatants. */
function encounter(...cs: Combatant[]): Encounter {
  return { id: 'e', name: 'E', campaignId: null, areaId: null, formatId: 'dnd5e', combatants: cs, combat: inactiveCombat() };
}

/** Starts combat with fixed initiatives: first argument acts first. */
function started(...cs: Combatant[]): Encounter {
  const rolled: Encounter = { ...encounter(...cs), combat: { active: true, round: 0, currentId: null } };
  const values = Object.fromEntries(cs.map((c, i) => [c.id, 100 - i]));
  return setInitiative(rolled, values, rules);
}

/** Moves on to the next turn, failing the test if Next Turn was blocked. */
function advance(e: Encounter, r: CombatRules = rules): Encounter {
  expect(nextTurnBlockers(e, r)).toEqual([]);
  return nextTurn(e, r);
}

/** Looks up a combatant by id (named for the common HP/status checks). */
const hp = (e: Encounter, id: string) => e.combatants.find((c) => c.id === id)!;

describe('initiative', () => {
  it('waits for PC initiative before the first turn', () => {
    const e = rollForInitiative(encounter(combatant('hero', 'pc', 20, 0), combatant('gob', 'npc', 7, 1)), rules);
    expect(e.combat.active).toBe(true);
    expect(e.combat.currentId).toBeNull();
    expect(awaitingInitiative(e).map((c) => c.id)).toEqual(['hero']);
    const ready = setInitiative(e, { hero: 30 }, rules);
    expect(ready.combat.currentId).toBe('hero');
    expect(ready.combat.round).toBe(1);
  });

  it('prompts for a combatant added mid-combat', () => {
    const e = started(combatant('a', 'npc', 5, 0));
    const added = { ...e, combatants: [...e.combatants, combatant('late', 'npc', 5, 1)] };
    expect(awaitingInitiative(added).map((c) => c.id)).toEqual(['late']);
    expect(nextTurnBlockers(added, rules)).not.toHaveLength(0);
  });
});

describe('turn flow', () => {
  it('advances, wraps and counts rounds', () => {
    let e = started(combatant('a', 'npc', 5, 0), combatant('b', 'npc', 5, 1));
    e = nextTurn(e, rules);
    expect(e.combat.currentId).toBe('b');
    e = nextTurn(e, rules);
    expect(e.combat.currentId).toBe('a');
    expect(e.combat.round).toBe(2);
  });

  it('kills an NPC at 0 HP at end of turn and skips it', () => {
    let e = started(combatant('a', 'npc', 5, 0), combatant('b', 'npc', 5, 1), combatant('c', 'npc', 5, 2));
    e = applyDamage(e, 'b', 10, rules);
    e = nextTurn(e, rules);
    expect(hp(e, 'b').status).toBe('dead');
    expect(e.combat.currentId).toBe('c');
  });

  it('a creature healed before end of turn survives', () => {
    let e = started(combatant('a', 'npc', 5, 0), combatant('b', 'npc', 5, 1));
    e = applyHealing(applyDamage(e, 'b', 10, rules), 'b', 3);
    e = nextTurn(e, rules);
    expect(hp(e, 'b').status).toBe('active');
  });

  const paralyzed = { id: 'paralyzed', name: 'Paralyzed', effect: '', endsWhen: '', repeatsSave: true };
  const prone = { id: 'prone', name: 'Prone', effect: '', endsWhen: '', repeatsSave: false };

  it('blocks Next Turn on a per-turn-save condition until resolved', () => {
    let e = started(combatant('a', 'npc', 5, 0), combatant('b', 'npc', 5, 1));
    e = addCondition(e, 'b', paralyzed);
    e = nextTurn(e, rules);
    expect(nextTurnBlockers(e, rules)).toEqual(['Resolve Paralyzed']);
    const inst = hp(e, 'b').conditions[0].instanceId;
    e = resolveCondition(e, 'b', inst);
    expect(nextTurnBlockers(e, rules)).toEqual([]);
  });

  it('conditions without a per-turn save never block', () => {
    let e = started(combatant('a', 'npc', 5, 0), combatant('b', 'npc', 5, 1));
    e = addCondition(e, 'b', prone);
    e = nextTurn(e, rules);
    expect(nextTurnBlockers(e, rules)).toEqual([]);
  });

  it('the per-turn save can be switched on or off for one instance', () => {
    let e = started(combatant('a', 'npc', 5, 0), combatant('b', 'npc', 5, 1));
    e = addCondition(e, 'b', prone, true);
    e = addCondition(e, 'b', paralyzed);
    const [proneInst, paraInst] = hp(e, 'b').conditions.map((c) => c.instanceId);
    e = setRequiresResolve(e, 'b', paraInst, false);
    e = nextTurn(e, rules);
    expect(nextTurnBlockers(e, rules)).toEqual(['Resolve Prone']);
    e = setRequiresResolve(e, 'b', proneInst, false);
    expect(nextTurnBlockers(e, rules)).toEqual([]);
  });
});

describe('death saves', () => {
  it('PC at 0 HP goes into death saves and must roll on their turn', () => {
    let e = started(combatant('gob', 'npc', 5, 0), combatant('hero', 'pc', 10, 1));
    e = applyDamage(e, 'hero', 10, rules);
    e = nextTurn(e, rules);
    expect(hp(e, 'hero').status).toBe('dying');
    expect(e.combat.currentId).toBe('hero');
    expect(nextTurnBlockers(e, rules)).toEqual(['hero must make a death save']);
    e = recordDeathSave(e, 'hero', { successes: 1, failures: 0 });
    expect(nextTurnBlockers(e, rules)).toEqual([]);
  });

  it('three successes stabilize and remove from the order', () => {
    let e = started(combatant('gob', 'npc', 5, 0), combatant('hero', 'pc', 10, 1));
    e = nextTurn(applyDamage(e, 'hero', 10, rules), rules);
    e = recordDeathSave(e, 'hero', { successes: 2, failures: 0 });
    e = recordDeathSave(e, 'hero', { successes: 1, failures: 0 });
    expect(hp(e, 'hero').status).toBe('stable');
    expect(turnOrder(e, rules).map((c) => c.id)).toEqual(['gob']);
    e = nextTurn(e, rules);
    expect(e.combat.currentId).toBe('gob');
  });

  it('healing a dying character clears saves at end of turn', () => {
    let e = started(combatant('gob', 'npc', 5, 0), combatant('hero', 'pc', 10, 1));
    e = nextTurn(applyDamage(e, 'hero', 10, rules), rules);
    e = recordDeathSave(e, 'hero', { successes: 0, failures: 2 });
    e = applyHealing(e, 'hero', 4);
    e = nextTurn(e, rules);
    expect(hp(e, 'hero').status).toBe('active');
    expect(hp(e, 'hero').dying).toEqual(noDyingProgress());
  });

  it('untracked-HP PC is dropped and revived manually', () => {
    let e = started(combatant('gob', 'npc', 5, 0), combatant('pc2', 'pc-untracked', null, 1));
    e = dropCombatant(e, 'pc2', rules);
    expect(hp(e, 'pc2').status).toBe('dying');
    e = nextTurn(e, rules);
    expect(nextTurnBlockers(e, rules)).toEqual(['pc2 must make a death save']);
    e = reviveCombatant(e, 'pc2', rules);
    expect(hp(e, 'pc2').status).toBe('active');
  });
});

describe('PF2e dying value', () => {
  const pf2 = rulesWith({ kind: 'dyingValue', deathAt: 4, wounded: { id: 'wounded', name: 'Wounded' }, doomedId: 'doomed' });
  const doomed: ConditionDef = { id: 'doomed', name: 'Doomed', effect: '', endsWhen: '', repeatsSave: false, valued: true };

  it('drops to Dying 1, recovers to stable with Wounded 1, and drops again at Dying 2', () => {
    let e = started(combatant('gob', 'npc', 5, 0), combatant('hero', 'pc', 10, 1));
    e = nextTurn(applyDamage(e, 'hero', 10, pf2), pf2);
    expect(hp(e, 'hero')).toMatchObject({ status: 'dying', dying: { value: 1 } });
    expect(nextTurnBlockers(e, pf2)).toEqual(['hero must make a recovery check']);
    e = recordRecoveryCheck(e, 'hero', -1, pf2);
    expect(hp(e, 'hero').status).toBe('stable');
    expect(conditionValue(hp(e, 'hero'), 'wounded')).toBe(1);
    // Healed while stable: back up, no extra Wounded.
    e = advance(applyHealing(advance(e, pf2), 'hero', 5), pf2);
    expect(hp(e, 'hero').status).toBe('active');
    expect(conditionValue(hp(e, 'hero'), 'wounded')).toBe(1);
    e = advance(applyDamage(e, 'hero', 10, pf2), pf2);
    expect(hp(e, 'hero')).toMatchObject({ status: 'dying', dying: { value: 2 } });
  });

  it('Doomed lowers the Dying value that kills', () => {
    let e = started(combatant('gob', 'npc', 5, 0), combatant('hero', 'pc', 10, 1));
    e = addCondition(e, 'hero', doomed);
    e = nextTurn(applyDamage(e, 'hero', 10, pf2), pf2);
    e = recordRecoveryCheck(e, 'hero', 2, pf2);
    expect(hp(e, 'hero').status).toBe('dead');
  });

  it('healing a dying creature brings it back with Wounded raised', () => {
    let e = started(combatant('gob', 'npc', 5, 0), combatant('hero', 'pc', 10, 1));
    e = nextTurn(applyDamage(e, 'hero', 10, pf2), pf2);
    e = recordRecoveryCheck(e, 'hero', 1, pf2);
    e = advance(applyHealing(e, 'hero', 3), pf2);
    expect(hp(e, 'hero')).toMatchObject({ status: 'active', dying: noDyingProgress() });
    expect(conditionValue(hp(e, 'hero'), 'wounded')).toBe(1);
  });

  it('an NPC without dying rules dies at 0 HP', () => {
    let e = started(combatant('gob', 'npc', 5, 0), combatant('orc', 'npc', 5, 1));
    e = nextTurn(applyDamage(e, 'orc', 9, pf2), pf2);
    expect(hp(e, 'orc').status).toBe('dead');
  });
});

describe('PF1e negative HP', () => {
  const pf1 = rulesWith({ kind: 'negativeHp' });

  it('0 HP keeps fighting; below 0 is dying; failed checks lose HP until the threshold kills', () => {
    let e = started(combatant('gob', 'npc', 5, 0), combatant('hero', 'pc', 10, 1));
    e = advance(applyDamage(e, 'hero', 10, pf1), pf1);
    expect(hp(e, 'hero')).toMatchObject({ status: 'active', currentHp: 0 });
    e = advance(applyDamage(e, 'hero', 3, pf1), pf1);
    expect(hp(e, 'hero')).toMatchObject({ status: 'dying', currentHp: -3 });
    e = nextTurn(e, pf1);
    expect(nextTurnBlockers(e, pf1)).toEqual(['hero must make a stabilization check']);
    e = recordStabilizationCheck(e, 'hero', false, pf1);
    expect(hp(e, 'hero')).toMatchObject({ status: 'dying', currentHp: -4 });
    e = advance(applyDamage(e, 'hero', 6, pf1), pf1);
    expect(hp(e, 'hero').status).toBe('dead');
  });

  it('a successful check stabilizes; healing to 0 or more brings them back', () => {
    let e = started(combatant('gob', 'npc', 5, 0), combatant('hero', 'pc', 10, 1));
    e = nextTurn(applyDamage(e, 'hero', 12, pf1), pf1);
    e = recordStabilizationCheck(e, 'hero', true, pf1);
    expect(hp(e, 'hero').status).toBe('stable');
    e = advance(applyHealing(advance(e, pf1), 'hero', 2), pf1);
    expect(hp(e, 'hero')).toMatchObject({ status: 'active', currentHp: 0 });
  });

  it('an NPC without dying rules dies below 0 HP', () => {
    let e = started(combatant('gob', 'npc', 5, 0), combatant('orc', 'npc', 5, 1));
    e = nextTurn(applyDamage(e, 'orc', 6, pf1), pf1);
    expect(hp(e, 'orc')).toMatchObject({ status: 'dead', currentHp: -1 });
  });
});

describe('dead at 0 (B/X)', () => {
  const bx = rulesWith({ kind: 'deadAtZero' });

  it('PCs die at 0 HP, and Drop kills an untracked PC', () => {
    let e = started(combatant('gob', 'npc', 5, 0), combatant('hero', 'pc', 10, 1), combatant('pc2', 'pc-untracked', null, 2));
    e = nextTurn(applyDamage(e, 'hero', 10, bx), bx);
    expect(hp(e, 'hero').status).toBe('dead');
    e = dropCombatant(e, 'pc2', bx);
    expect(hp(e, 'pc2').status).toBe('dead');
  });
});

describe('valued conditions', () => {
  const frightened: ConditionDef = {
    id: 'frightened', name: 'Frightened', effect: '', endsWhen: '', repeatsSave: false, valued: true, dropsEachTurn: true,
  };

  it('start at 1 and drop by 1 only at the end of their own turn, ending at 0', () => {
    let e = started(combatant('a', 'npc', 5, 0), combatant('b', 'npc', 5, 1));
    e = addCondition(e, 'b', frightened);
    const inst = hp(e, 'b').conditions[0];
    expect(inst).toMatchObject({ value: 1, dropsEachTurn: true });
    e = setConditionValue(e, 'b', inst.instanceId, 2);
    e = advance(e);
    expect(conditionValue(hp(e, 'b'), 'frightened')).toBe(2);
    e = advance(e);
    expect(conditionValue(hp(e, 'b'), 'frightened')).toBe(1);
    e = advance(advance(e));
    expect(hp(e, 'b').conditions).toEqual([]);
  });

  it('setting the value to 0 removes the condition', () => {
    let e = started(combatant('a', 'npc', 5, 0));
    e = addCondition(e, 'a', frightened);
    e = setConditionValue(e, 'a', hp(e, 'a').conditions[0].instanceId, 0);
    expect(hp(e, 'a').conditions).toEqual([]);
  });
});
