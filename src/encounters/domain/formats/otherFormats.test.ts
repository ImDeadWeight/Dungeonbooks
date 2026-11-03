/**
 * @file Tests for SF2e, PF1e, 3.5e and B/X as the combat tracker uses them:
 * death thresholds from the stat block, B/X side initiative (one roll per
 * side, re-rolled every round, newcomers and side changes), and stat block
 * validation.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterTemplate } from '../characters';
import { applyDamage } from '../combat/health';
import { assignSideInitiative, rollForInitiative, setCombatantSide, sideOf, turnOrder } from '../combat/initiative';
import { combatRulesFrom } from '../combat/rules';
import { nextTurn, nextTurnBlockers } from '../combat/turnFlow';
import { inactiveCombat } from '../combat/types';
import { addToCombatants } from '../library/combatantFactory';
import type { Encounter } from '../library/types';
import { createEmptyBxStatBlock } from 'campaign-link/formats/bx/statBlock';
import { createEmptyD20StatBlock } from 'campaign-link/formats/d20/statBlock';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { FORMATS } from 'campaign-link/formats/registry';

/** An encounter of the given format out of combat, built from templates the way the app does. */
function encounterOf(formatId: FormatId, templates: CharacterTemplate[], lines: [string, number][]): Encounter {
  const lookup = (id: string) => templates.find((t) => t.id === id);
  const combatants = addToCombatants([], lines.map(([templateId, quantity]) => ({ templateId, quantity })), lookup, formatId);
  return { id: 'e', name: 'E', campaignId: null, areaId: null, formatId, combatants, combat: inactiveCombat() };
}
const byName = (e: Encounter, name: string) => e.combatants.find((c) => c.name === name)!;

describe('SF2e', () => {
  it('uses the PF2e stat block and dying rules with its own condition ids', () => {
    const sf2e = FORMATS.sf2e;
    expect(sf2e.statBlockType).toBe(FORMATS.pf2e.statBlockType);
    expect(sf2e.conditions.every((c) => c.id.startsWith('sf2e:'))).toBe(true);
    if (sf2e.dying.kind !== 'dyingValue') throw new Error('SF2e uses the Dying value');
    const ids = sf2e.conditions.map((c) => c.id);
    expect(ids).toContain(sf2e.dying.wounded.id);
    expect(ids).toContain(sf2e.dying.doomedId);
  });
});

describe('PF1e and 3.5e', () => {
  /** A PC with CON 12 and 10 HP, and an undead with no CON score and 10 HP. */
  const templates = (formatId: FormatId): CharacterTemplate[] => {
    const blank = createEmptyD20StatBlock();
    return [
      { id: 'pc', name: 'Hero', kind: 'pc', formatId, tagIds: [], deathSaves: true, statBlock: { ...blank, abilities: { ...blank.abilities, con: 12 } } },
      { id: 'zom', name: 'Zombie', kind: 'npc', formatId, tagIds: [], deathSaves: true, statBlock: { ...blank, abilities: { ...blank.abilities, con: 0 } } },
    ];
  };

  /** A fight already under way on the hero's turn, with the rules for the format. */
  function fight(formatId: FormatId) {
    const ts = templates(formatId);
    const rules = combatRulesFrom(formatId, (id) => ts.find((t) => t.id === id));
    let e = rollForInitiative(encounterOf(formatId, ts, [['pc', 1], ['zom', 1]]), rules);
    e = { ...e, combatants: e.combatants.map((c) => ({ ...c, initiative: c.name === 'Hero' ? 30 : 1 })) };
    e = { ...e, combat: { ...e.combat, round: 1, currentId: byName(e, 'Hero').id } };
    return { e, rules };
  }

  it('PF1e: dying below 0, dead at minus the CON score', () => {
    const { e: start, rules } = fight('pf1e');
    const hero = byName(start, 'Hero').id;
    let e = nextTurn(applyDamage(start, hero, 21, rules), rules);
    expect(byName(e, 'Hero')).toMatchObject({ status: 'dying', currentHp: -11 });
    e = nextTurn(applyDamage(e, hero, 1, rules), rules);
    expect(byName(e, 'Hero').status).toBe('dead');
  });

  it('3.5e: dead at −10 regardless of CON', () => {
    const { e: start, rules } = fight('dnd35');
    const e = nextTurn(applyDamage(start, byName(start, 'Hero').id, 20, rules), rules);
    expect(byName(e, 'Hero')).toMatchObject({ status: 'dead', currentHp: -10 });
  });

  it('a creature with no CON score is destroyed at 0 HP', () => {
    const { e: start, rules } = fight('pf1e');
    const e = nextTurn(applyDamage(start, byName(start, 'Zombie').id, 10, rules), rules);
    expect(byName(e, 'Zombie').status).toBe('dead');
  });

  it('validates imported stat blocks', () => {
    const sb = FORMATS.pf1e.sanitizeStatBlock({ initiative: 99, abilities: { con: -3 }, hitDice: { count: 2, sides: 8, bonus: 2 } }, 'sb');
    expect(sb).toMatchObject({ initiative: 50, abilities: { con: 0, str: 10 }, hitDice: { count: 2, sides: 8, bonus: 2 } });
    expect(() => FORMATS.pf1e.sanitizeStatBlock({ size: 'Enormous' }, 'sb')).toThrow(/sb.size/);
  });
});

describe('B/X side initiative', () => {
  const templates: CharacterTemplate[] = [
    { id: 'pc', name: 'Fighter', kind: 'pc', formatId: 'bx', tagIds: [], deathSaves: true, statBlock: createEmptyBxStatBlock() },
    { id: 'orc', name: 'Orc', kind: 'npc', formatId: 'bx', tagIds: [], deathSaves: false, statBlock: createEmptyBxStatBlock() },
  ];
  const lookup = (id: string) => templates.find((t) => t.id === id);
  const rules = combatRulesFrom('bx', lookup);
  const start = () => rollForInitiative(encounterOf('bx', templates, [['pc', 1], ['orc', 3]]), rules);

  /** Initiative of each side, failing if a side's members disagree. */
  function sideRolls(e: Encounter): Map<string, number> {
    const rolls = new Map<string, number>();
    for (const c of e.combatants) {
      const side = sideOf(c, rules);
      if (rolls.has(side)) expect(c.initiative).toBe(rolls.get(side));
      rolls.set(side, c.initiative!);
    }
    return rolls;
  }

  it('rolls one d6 per side with no ties, and nobody has to enter initiative', () => {
    for (let i = 0; i < 20; i++) {
      const e = start();
      const rolls = sideRolls(e);
      expect([...rolls.keys()].sort()).toEqual(['Monsters', 'Party']);
      expect(new Set(rolls.values()).size).toBe(2);
      for (const r of rolls.values()) expect(r >= 1 && r <= 6).toBe(true);
      expect(e.combat.round).toBe(1);
      expect(nextTurnBlockers(e, rules)).toEqual([]);
      // The winning side's members act first, together.
      const order = turnOrder(e, rules).map((c) => sideOf(c, rules));
      expect(order).toEqual([...order].sort((a, b) => rolls.get(b)! - rolls.get(a)!));
    }
  });

  it('re-rolls every side when a new round starts', () => {
    let e = start();
    for (let i = 0; i < 4; i++) e = nextTurn(e, rules);
    expect(e.combat.round).toBe(2);
    sideRolls(e);
    expect(e.combat.currentId).toBe(turnOrder(e, rules)[0].id);
  });

  it('newcomers take their side roll; a new side gets its own', () => {
    let e = start();
    const rolls = sideRolls(e);
    e = setCombatantSide(e, byName(e, 'Orc 2').id, 'Goblins', rules);
    expect(sideOf(byName(e, 'Orc 2'), rules)).toBe('Goblins');
    const after = sideRolls(e);
    expect(after.get('Monsters')).toBe(rolls.get('Monsters'));
    expect(new Set(after.values()).size).toBe(3);
    const added = { ...e, combatants: addToCombatants(e.combatants, [{ templateId: 'orc', quantity: 1 }], lookup, 'bx') };
    expect(byName(assignSideInitiative(added, rules), 'Orc 4').initiative).toBe(rolls.get('Monsters'));
  });

  it('0 HP is dead, even for a PC', () => {
    let e = start();
    e = nextTurn(applyDamage(e, byName(e, 'Fighter').id, 99, rules), rules);
    expect(byName(e, 'Fighter').status).toBe('dead');
  });
});
