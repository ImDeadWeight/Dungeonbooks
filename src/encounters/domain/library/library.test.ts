/**
 * @file Tests for building encounters (copy numbering, per-copy HP rolls,
 * one PC each) and moving areas/encounters in the tree.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterTemplate } from '../characters';
import { createEmptyStatBlock } from 'campaign-link/formats/dnd5e/statBlock';
import { addToCombatants } from './combatantFactory';
import { adoptOrphans, areaContents, deleteArea, deleteCampaignContents, filterCampaign, flattenAreas, moveArea, moveEncounter, normalizeAreas } from './tree';
import type { Encounter, Library } from './types';
import { inactiveCombat } from '../combat/types';

/** NPC with 2d6 hit dice. */
const goblin: CharacterTemplate = {
  id: 'gob', name: 'Goblin', kind: 'npc', formatId: 'dnd5e', tagIds: [], deathSaves: false,
  statBlock: { ...createEmptyStatBlock(), maxHp: 7, hitDice: { count: 2, sides: 6, bonus: 0 } },
};
/** PC without a stat block (untracked HP). */
const hero: CharacterTemplate = {
  id: 'hero', name: 'Hero', kind: 'pc', formatId: 'dnd5e', tagIds: [], deathSaves: true, statBlock: null,
};
/** Template lookup over the two fixtures. */
const lookup = (id: string) => [goblin, hero].find((t) => t.id === id);

describe('addToCombatants', () => {
  it('numbers copies and renames an earlier lone copy', () => {
    const one = addToCombatants([], [{ templateId: 'gob', quantity: 1 }], lookup, 'dnd5e');
    expect(one.map((c) => c.name)).toEqual(['Goblin']);
    const three = addToCombatants(one, [{ templateId: 'gob', quantity: 2 }], lookup, 'dnd5e');
    expect(three.map((c) => c.name)).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3']);
  });

  it('rolls HP within the hit dice range per copy', () => {
    const many = addToCombatants([], [{ templateId: 'gob', quantity: 30 }], lookup, 'dnd5e');
    for (const c of many) expect(c.maxHp).toBeGreaterThanOrEqual(2);
    for (const c of many) expect(c.maxHp).toBeLessThanOrEqual(12);
  });

  it('skips characters of another format than the encounter', () => {
    expect(addToCombatants([], [{ templateId: 'gob', quantity: 2 }], lookup, 'dnd5e2024')).toEqual([]);
  });

  it('adds a PC once with untracked HP when there is no stat block', () => {
    const cs = addToCombatants([], [{ templateId: 'hero', quantity: 3 }, { templateId: 'hero', quantity: 1 }], lookup, 'dnd5e');
    expect(cs).toHaveLength(1);
    expect(cs[0].currentHp).toBeNull();
  });
});

describe('tree moves', () => {
  const lib: Library = {
    campaigns: [{ id: 'c1', name: 'One', formatId: null }, { id: 'c2', name: 'Two', formatId: null }],
    areas: [{ id: 'a1', name: 'Cave', campaignId: 'c1', parentAreaId: null }],
    encounters: [{ id: 'e1', name: 'Ambush', campaignId: 'c1', areaId: 'a1', formatId: 'dnd5e', combatants: [], combat: inactiveCombat() }],
  };

  it('moving an area carries its encounters', () => {
    const moved = moveArea(lib, 'a1', { kind: 'campaign', campaignId: 'c2' });
    expect(moved.encounters[0].campaignId).toBe('c2');
  });

  it('dropping an encounter on an area sets both parents', () => {
    const loose = moveEncounter(lib, 'e1', { kind: 'campaign', campaignId: 'c2' });
    expect(loose.encounters[0]).toMatchObject({ campaignId: 'c2', areaId: null });
    const back = moveEncounter(loose, 'e1', { kind: 'area', areaId: 'a1' });
    expect(back.encounters[0]).toMatchObject({ campaignId: 'c1', areaId: 'a1' });
  });

  it("deleting a campaign's contents leaves other campaigns alone", () => {
    const withTwo = moveEncounter(lib, 'e1', { kind: 'campaign', campaignId: 'c2' });
    const left = deleteCampaignContents(withTwo, 'c1');
    expect(left.areas).toEqual([]);
    expect(left.encounters.map((e) => e.id)).toEqual(['e1']);
  });

  it('moves unfiled encounters and areas of missing campaigns into the given campaign', () => {
    const old = {
      areas: [{ id: 'a9', name: 'Lost', campaignId: 'gone', parentAreaId: null }],
      encounters: [
        { ...lib.encounters[0], id: 'e2', campaignId: null as unknown as string, areaId: null },
        { ...lib.encounters[0], id: 'e3', campaignId: 'gone', areaId: 'a9' },
        lib.encounters[0],
      ],
    };
    const adopted = adoptOrphans(old, new Set(['c1', 'c2']), 'c2');
    expect(adopted.areas[0].campaignId).toBe('c2');
    expect(adopted.encounters.map((e) => [e.campaignId, e.areaId])).toEqual([['c2', null], ['c2', 'a9'], ['c1', 'a1']]);
    expect(adoptOrphans(adopted, new Set(['c1', 'c2']), 'c2')).toBe(adopted);
  });

  describe('nested areas', () => {
    const nested: Library = {
      campaigns: [{ id: 'c1', name: 'One', formatId: null }, { id: 'c2', name: 'Two', formatId: null }],
      areas: [
        { id: 'prison', name: 'Prison', campaignId: 'c1', parentAreaId: null },
        { id: 'mines', name: 'Mines', campaignId: 'c1', parentAreaId: null },
        { id: 'shaft', name: 'Shaft', campaignId: 'c1', parentAreaId: 'mines' },
      ],
      encounters: [{ id: 'e1', name: 'Cave-in', campaignId: 'c1', areaId: 'shaft', formatId: 'dnd5e', combatants: [], combat: inactiveCombat() }],
    };

    it('moves an area inside another area, carrying its contents', () => {
      const moved = moveArea(nested, 'mines', { kind: 'area', areaId: 'prison' });
      expect(moved.areas.find((a) => a.id === 'mines')?.parentAreaId).toBe('prison');
      expect(flattenAreas(moved, 'c1').map((x) => x.path)).toEqual(['Prison', 'Prison › Mines', 'Prison › Mines › Shaft']);
    });

    it('refuses to move an area into itself or its own sub-area', () => {
      expect(moveArea(nested, 'mines', { kind: 'area', areaId: 'mines' })).toBe(nested);
      expect(moveArea(nested, 'mines', { kind: 'area', areaId: 'shaft' })).toBe(nested);
    });

    it('moving into another campaign updates nested areas and encounters', () => {
      const moved = moveArea(nested, 'mines', { kind: 'campaign', campaignId: 'c2' });
      expect(moved.areas.find((a) => a.id === 'shaft')?.campaignId).toBe('c2');
      expect(moved.encounters[0].campaignId).toBe('c2');
    });

    it('deleting an area deletes everything nested in it', () => {
      expect(areaContents(nested, 'mines')).toEqual({ areas: 1, encounters: 1 });
      const after = deleteArea(nested, 'mines');
      expect(after.areas.map((a) => a.id)).toEqual(['prison']);
      expect(after.encounters).toHaveLength(0);
    });

    it('normalizing breaks parent loops and fixes campaigns', () => {
      const fixed = normalizeAreas([
        { id: 'a', name: 'A', campaignId: 'c1', parentAreaId: 'b' },
        { id: 'b', name: 'B', campaignId: 'c2', parentAreaId: 'a' },
      ]);
      expect(fixed.filter((a) => a.parentAreaId === null)).toHaveLength(1);
      expect(new Set(fixed.map((a) => a.campaignId)).size).toBe(1);
    });
  });
});

describe('sidebar search', () => {
  const encounter = (id: string, name: string, campaignId: string, areaId: string | null): Encounter =>
    ({ id, name, campaignId, areaId, formatId: 'dnd5e', combatants: [], combat: inactiveCombat() });
  // One › Mines › Shaft holds "Cave-in"; "Ambush" is loose in One; "Bandits" is in Two.
  const lib: Library = {
    campaigns: [{ id: 'c1', name: 'One', formatId: null }, { id: 'c2', name: 'Two', formatId: null }],
    areas: [
      { id: 'mines', name: 'Mines', campaignId: 'c1', parentAreaId: null },
      { id: 'shaft', name: 'Shaft', campaignId: 'c1', parentAreaId: 'mines' },
    ],
    encounters: [
      encounter('cave', 'Cave-in', 'c1', 'shaft'),
      encounter('ambush', 'Ambush', 'c1', null),
      encounter('bandits', 'Bandits', 'c2', null),
    ],
  };
  const visible = (query: string, campaignId = 'c1') => [...(filterCampaign(lib, campaignId, query)?.visible ?? [])].sort();

  it('is off for a blank search', () => {
    expect(filterCampaign(lib, 'c1', ' ')).toBeNull();
  });

  it('shows a matching encounter with its areas, opened', () => {
    const filter = filterCampaign(lib, 'c1', 'CAVE')!;
    expect([...filter.visible].sort()).toEqual(['cave', 'mines', 'shaft']);
    expect([...filter.opened].sort()).toEqual(['mines', 'shaft']);
  });

  it('shows everything inside a matching area without opening it', () => {
    const filter = filterCampaign(lib, 'c1', 'mines')!;
    expect([...filter.visible].sort()).toEqual(['cave', 'mines', 'shaft']);
    expect([...filter.opened]).toEqual([]);
  });

  it("only looks in the open campaign", () => {
    expect(visible('band')).toEqual([]);
    expect(visible('band', 'c2')).toEqual(['bandits']);
    expect(visible('zzz')).toEqual([]);
  });
});
