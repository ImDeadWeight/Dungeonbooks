/**
 * @file Tests for the PF2e format as the combat tracker uses it: foes win
 * initiative ties, 0 HP gives Dying plus Wounded, Frightened drops each
 * turn, and imported stat blocks are validated.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterTemplate } from '../../characters';
import { addCondition, conditionValue } from '../../combat/conditions';
import { recordRecoveryCheck } from '../../combat/dying';
import { applyDamage } from '../../combat/health';
import { setInitiative, sortByInitiative } from '../../combat/initiative';
import { combatRulesFrom } from '../../combat/rules';
import { nextTurn, nextTurnBlockers } from '../../combat/turnFlow';
import { inactiveCombat } from '../../combat/types';
import { addToCombatants } from '../../library/combatantFactory';
import type { Encounter } from '../../library/types';
import { pf2e } from 'campaign-link/formats/pf2e/index';
import { createEmptyPf2eStatBlock } from 'campaign-link/formats/pf2e/statBlock';

/** A level 1 goblin with Perception +2 and 6 HP. */
const goblin: CharacterTemplate = {
  id: 'gob', name: 'Goblin', kind: 'npc', formatId: 'pf2e', tagIds: [], deathSaves: false,
  statBlock: { ...createEmptyPf2eStatBlock(), perception: 2, maxHp: 6 },
};
/** A PC with Perception +2 and 20 HP. */
const hero: CharacterTemplate = {
  id: 'hero', name: 'Hero', kind: 'pc', formatId: 'pf2e', tagIds: [], deathSaves: true,
  statBlock: { ...createEmptyPf2eStatBlock(), perception: 2, maxHp: 20 },
};
const lookup = (id: string) => [goblin, hero].find((t) => t.id === id);
const rules = combatRulesFrom('pf2e', lookup);

/** A PF2e encounter in combat with the hero and the goblin at these initiatives. */
function fight(heroInit: number, goblinInit: number): Encounter {
  const combatants = addToCombatants(
    [],
    [{ templateId: 'hero', quantity: 1 }, { templateId: 'gob', quantity: 1 }],
    lookup,
    'pf2e',
  );
  const enc: Encounter = {
    id: 'e', name: 'E', campaignId: null, areaId: null, formatId: 'pf2e', combatants,
    combat: { ...inactiveCombat(), active: true },
  };
  const [h, g] = combatants;
  return setInitiative(enc, { [h.id]: heroInit, [g.id]: goblinInit }, rules);
}
const byName = (e: Encounter, name: string) => e.combatants.find((c) => c.name === name)!;

describe('PF2e', () => {
  it('rolls initiative from Perception and lets foes win ties', () => {
    expect(rules.initiativeModifier('gob')).toBe(2);
    const e = fight(12, 12);
    expect(sortByInitiative(e.combatants, rules).map((c) => c.name)).toEqual(['Goblin', 'Hero']);
  });

  it('a PC at 0 HP gains Dying 1, and recovering adds Wounded', () => {
    let e = fight(20, 10);
    const heroId = byName(e, 'Hero').id;
    e = nextTurn(applyDamage(e, heroId, 25, rules), rules);
    expect(byName(e, 'Hero')).toMatchObject({ currentHp: 0, status: 'dying', dying: { value: 1 } });
    e = nextTurn(e, rules);
    expect(nextTurnBlockers(e, rules)).toEqual(['Hero must make a recovery check']);
    e = recordRecoveryCheck(e, heroId, -2, rules);
    expect(byName(e, 'Hero').status).toBe('stable');
    expect(conditionValue(byName(e, 'Hero'), 'pf2e:wounded')).toBe(1);
  });

  it('a monster dies at 0 HP', () => {
    let e = fight(20, 10);
    e = nextTurn(applyDamage(e, byName(e, 'Goblin').id, 6, rules), rules);
    expect(byName(e, 'Goblin').status).toBe('dead');
  });

  it('Frightened drops by 1 at the end of its own turn', () => {
    let e = fight(20, 10);
    const frightened = pf2e.conditions.find((c) => c.name === 'Frightened')!;
    e = addCondition(e, byName(e, 'Hero').id, frightened);
    e = nextTurn(e, rules);
    expect(byName(e, 'Hero').conditions).toEqual([]);
  });

  it('Wounded and Doomed named by the dying rules exist as valued conditions', () => {
    if (pf2e.dying.kind !== 'dyingValue') throw new Error('PF2e uses the Dying value');
    const ids = [pf2e.dying.wounded.id, pf2e.dying.doomedId];
    for (const id of ids) expect(pf2e.conditions.find((c) => c.id === id)).toMatchObject({ valued: true });
  });

  it('validates imported stat blocks: clamps, defaults, and rejects bad Strikes', () => {
    const sb = pf2e.sanitizeStatBlock({ level: 99, perception: 7, attributes: { str: 50 }, strikes: [] }, 'sb');
    expect(sb).toMatchObject({ level: 25, perception: 7, armorClass: 15, attributes: { str: 10, dex: 0 } });
    expect(() => pf2e.sanitizeStatBlock({ strikes: [{ kind: 'thrown', name: 'x', bonus: 1 }] }, 'sb')).toThrow(/sb.strikes\[0\].kind/);
  });
});
