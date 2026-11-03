/**
 * @file Tests for export and import: dependency bundling, exact round-trips,
 * placement, every conflict resolution, tag/condition merging by name,
 * older-format files, and rejection of invalid files.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterTemplate } from '../characters';
import { inactiveCombat, noDyingProgress, type Combatant } from '../combat/types';
import { createEmptyStatBlock, type Dnd5eStatBlock } from 'campaign-link/formats/dnd5e/statBlock';
import type { Encounter } from '../library/types';
import { applyImport } from './applyImport';
import { exportArea, exportCampaign, exportCharacters, exportEncounter, exportEverything, toTransferFile } from './exportBundle';
import { parseTransferFile } from './parseFile';
import { itemKey, openConflicts, planImport, type Resolution } from './plan';
import type { AppData, TransferFile, TransferKind, Bundle } from './types';

const goblin: CharacterTemplate = {
  id: 'gob', name: 'Goblin', kind: 'npc', formatId: 'dnd5e', tagIds: ['t-goblinoid'], deathSaves: false,
  statBlock: { ...createEmptyStatBlock(), maxHp: 7, hitDice: { count: 2, sides: 6, bonus: 0 } },
};
const hero: CharacterTemplate = { id: 'hero', name: 'Hero', kind: 'pc', formatId: 'dnd5e', tagIds: [], deathSaves: true, statBlock: null };

/** A wounded combatant mid-combat with a custom Bleeding condition. */
function combatant(id: string, templateId: string): Combatant {
  return {
    id, templateId, name: id, maxHp: 7, currentHp: 3, tempHp: 0, initiative: 12, addedOrder: 0,
    tokenDescription: 'red mini', side: '', status: 'active', dying: noDyingProgress(), dyingRollMadeThisTurn: false,
    conditions: [{ instanceId: 'i1', conditionId: 'c-bleeding', name: 'Bleeding', value: null, dropsEachTurn: false, requiresResolve: true, resolvedThisTurn: false }],
  };
}

/** An encounter in round 3 of active combat, inside campaign c1 / area a1. */
const ambush: Encounter = {
  id: 'e1', name: 'Ambush', campaignId: 'c1', areaId: 'a1', formatId: 'dnd5e',
  combatants: [combatant('g1', 'gob')],
  combat: { active: true, round: 3, currentId: 'g1' },
};

/** A small full library: one campaign, area, two encounters, two characters, tags, a custom condition. */
function state(): AppData {
  return {
    campaigns: [{ id: 'c1', name: 'Lost Mine', formatId: 'dnd5e' }],
    areas: [{ id: 'a1', name: 'Cave', campaignId: 'c1', parentAreaId: null }],
    encounters: [ambush, { id: 'e2', name: 'Loose', campaignId: null, areaId: null, formatId: 'dnd5e', combatants: [], combat: inactiveCombat() }],
    templates: [goblin, hero],
    tags: [{ id: 't-goblinoid', name: 'Goblinoid' }, { id: 't-unused', name: 'Unused' }],
    customConditions: [{ id: 'c-bleeding', name: 'Bleeding', formatId: 'dnd5e', effect: 'Loses 1d4 HP', endsWhen: '', repeatsSave: true }],
  };
}

/** App data for a fresh install. */
const empty = (): AppData => ({ campaigns: [], areas: [], encounters: [], templates: [], tags: [], customConditions: [] });

/** Export → JSON text → parse, exactly as a real file would travel. */
function roundTrip(kind: TransferKind, bundle: Bundle): TransferFile {
  const parsed = parseTransferFile(JSON.stringify(toTransferFile(kind, bundle)));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.file;
}

/** Plans and applies an import the way the preview dialog does. */
function importInto(target: AppData, file: TransferFile, resolutions: Record<string, Resolution> = {}, placement = { campaignId: null as string | null, areaId: null as string | null }) {
  return applyImport(target, file, planImport(file, target), resolutions, placement);
}

describe('export', () => {
  it('bundles dependencies of an encounter but nothing unrelated', () => {
    const b = exportEncounter(state(), 'e1');
    expect(b.templates.map((t) => t.id)).toEqual(['gob']);
    expect(b.tags.map((t) => t.id)).toEqual(['t-goblinoid']);
    expect(b.customConditions.map((c) => c.id)).toEqual(['c-bleeding']);
  });

  it('keeps live combat state exactly', () => {
    const file = roundTrip('encounter', exportEncounter(state(), 'e1'));
    expect(file.data.encounters[0]).toEqual(ambush);
  });
});

describe('import into an empty app', () => {
  it('a full backup restores everything unchanged', () => {
    const { data, summary } = importInto(empty(), roundTrip('everything', exportEverything(state())));
    expect(data).toEqual(state());
    expect(summary.added).toBe(6);
  });

  it('an area goes into the chosen campaign with its encounters', () => {
    const target = { ...empty(), campaigns: [{ id: 'x', name: 'Other', formatId: null }] };
    const { data } = importInto(target, roundTrip('area', exportArea(state(), 'a1')), {}, { campaignId: 'x', areaId: null });
    expect(data.areas[0].campaignId).toBe('x');
    expect(data.encounters[0]).toMatchObject({ campaignId: 'x', areaId: 'a1' });
  });

  it('a nested area exports and imports with everything inside it', () => {
    const nested: AppData = {
      ...state(),
      areas: [...state().areas, { id: 'a2', name: 'Shaft', campaignId: 'c1', parentAreaId: 'a1' }],
      encounters: [...state().encounters, { id: 'e3', name: 'Cave-in', campaignId: 'c1', areaId: 'a2', formatId: 'dnd5e', combatants: [], combat: inactiveCombat() }],
    };
    const target = { ...empty(), campaigns: [{ id: 'x', name: 'Other', formatId: null }] };
    const { data } = importInto(target, roundTrip('area', exportArea(nested, 'a1')), {}, { campaignId: 'x', areaId: null });
    expect(data.areas).toEqual([
      { id: 'a1', name: 'Cave', campaignId: 'x', parentAreaId: null },
      { id: 'a2', name: 'Shaft', campaignId: 'x', parentAreaId: 'a1' },
    ]);
    expect(data.encounters.find((e) => e.id === 'e3')).toMatchObject({ campaignId: 'x', areaId: 'a2' });
  });

  it('files from before nested areas and campaign formats still import', () => {
    const file = JSON.parse(JSON.stringify(toTransferFile('everything', exportEverything(state())))) as { data: { campaigns: Record<string, unknown>[]; areas: Record<string, unknown>[] } };
    file.data.campaigns = file.data.campaigns.map(({ formatId: _f, ...c }: Record<string, unknown>) => c);
    file.data.areas = file.data.areas.map(({ parentAreaId: _p, ...a }: Record<string, unknown>) => a);
    const parsed = parseTransferFile(JSON.stringify(file));
    expect(parsed.ok && parsed.file.data.campaigns[0].formatId).toBe(null);
    expect(parsed.ok && parsed.file.data.areas[0].parentAreaId).toBe(null);
  });

  it('rejects areas nested in a loop', () => {
    const looped = { ...state(), areas: [
      { id: 'a1', name: 'Cave', campaignId: 'c1', parentAreaId: 'a2' },
      { id: 'a2', name: 'Shaft', campaignId: 'c1', parentAreaId: 'a1' },
    ] };
    const parsed = parseTransferFile(JSON.stringify(toTransferFile('everything', exportEverything(looped))));
    expect(parsed.ok).toBe(false);
  });

  it('a single encounter goes where the user placed it', () => {
    const target = { ...empty(), campaigns: [{ id: 'x', name: 'Other', formatId: null }] };
    const { data } = importInto(target, roundTrip('encounter', exportEncounter(state(), 'e1')), {}, { campaignId: 'x', areaId: null });
    expect(data.encounters[0]).toMatchObject({ campaignId: 'x', areaId: null });
  });
});

describe('conflicts', () => {
  it('re-importing identical data changes nothing', () => {
    const file = roundTrip('everything', exportEverything(state()));
    const plan = planImport(file, state());
    expect(plan.items.every((i) => i.status === 'identical')).toBe(true);
    expect(importInto(state(), file).data).toEqual(state());
  });

  it('a changed character is a conflict; default keeps mine, "theirs" replaces', () => {
    const changed = { ...state(), templates: [{ ...goblin, name: 'Goblin Boss' }, hero] };
    const file = roundTrip('characters', exportCharacters(changed, ['gob']));
    expect(openConflicts(file.data, planImport(file, state()), {}).map((i) => i.key)).toEqual(['character:gob']);
    expect(importInto(state(), file).data.templates[0].name).toBe('Goblin');
    expect(importInto(state(), file, { 'character:gob': 'theirs' }).data.templates[0].name).toBe('Goblin Boss');
  });

  it('"keep both" on a character copies it and re-points imported combatants', () => {
    const changed = { ...state(), templates: [{ ...goblin, name: 'Goblin Boss' }, hero] };
    changed.encounters = changed.encounters.map((e) => (e.id === 'e1' ? { ...e, name: 'Ambush v2' } : e));
    const file = roundTrip('encounter', exportEncounter(changed, 'e1'));
    const { data } = importInto(state(), file, { 'character:gob': 'both', 'encounter:e1': 'theirs' });
    const copy = data.templates.find((t) => t.name === 'Goblin Boss (imported)')!;
    expect(copy.id).not.toBe('gob');
    expect(data.encounters.find((e) => e.id === 'e1')!.combatants[0].templateId).toBe(copy.id);
    expect(data.templates.find((t) => t.id === 'gob')!.name).toBe('Goblin');
  });

  it('"keep both" on a campaign copies its areas and encounters too', () => {
    const changed = { ...state(), campaigns: [{ id: 'c1', name: 'Lost Mine (other device)', formatId: 'dnd5e' as const }] };
    const file = roundTrip('campaign', exportCampaign(changed, 'c1'));
    const plan = planImport(file, state());
    const resolutions = { [itemKey('campaign', 'c1')]: 'both' as const };
    expect(openConflicts(file.data, plan, resolutions).map((i) => i.key)).toEqual(['campaign:c1']);
    const { data } = importInto(state(), file, resolutions);
    expect(data.campaigns).toHaveLength(2);
    const newCampaign = data.campaigns.find((c) => c.id !== 'c1')!;
    expect(newCampaign.name).toBe('Lost Mine (other device) (imported)');
    const newArea = data.areas.find((a) => a.campaignId === newCampaign.id)!;
    expect(newArea.id).not.toBe('a1');
    expect(data.encounters.filter((e) => e.areaId === newArea.id)).toHaveLength(1);
  });
});

describe('tags and conditions', () => {
  it('merge by name instead of duplicating', () => {
    const other = { ...state(), tags: [{ id: 'other-tag-id', name: 'goblinoid' }], customConditions: [{ id: 'other-c', name: 'BLEEDING', formatId: 'dnd5e' as const, effect: '', endsWhen: '', repeatsSave: true }] };
    other.templates = [{ ...goblin, tagIds: ['other-tag-id'] }, hero];
    other.encounters = [{ ...ambush, combatants: [{ ...combatant('g1', 'gob'), conditions: [{ instanceId: 'i1', conditionId: 'other-c', name: 'Bleeding', value: null, dropsEachTurn: false, requiresResolve: true, resolvedThisTurn: false }] }] }];
    const file = roundTrip('encounter', exportEncounter(other, 'e1'));
    const { data } = importInto(state(), file, { 'character:gob': 'theirs', 'encounter:e1': 'theirs' });
    expect(data.tags).toHaveLength(2);
    expect(data.templates.find((t) => t.id === 'gob')!.tagIds).toEqual(['t-goblinoid']);
    expect(data.customConditions).toHaveLength(1);
    expect(data.encounters.find((e) => e.id === 'e1')!.combatants[0].conditions[0].conditionId).toBe('c-bleeding');
  });
});

describe('validation', () => {
  // Deep copy: tests mutate the result, and exports share objects with the fixture.
  const valid = (): TransferFile => JSON.parse(JSON.stringify(toTransferFile('encounter', exportEncounter(state(), 'e1'))));
  // Serialises an (possibly tampered) object and parses it like a file.
  const parse = (f: unknown) => parseTransferFile(JSON.stringify(f));

  it('rejects non-JSON, foreign files and newer versions', () => {
    expect(parseTransferFile('not json')).toMatchObject({ ok: false });
    expect(parse({ app: 'something-else' })).toMatchObject({ ok: false });
    expect(parse({ ...valid(), schemaVersion: 99 })).toMatchObject({ ok: false, error: expect.stringContaining('newer version') });
  });

  it('rejects a combatant whose character is missing', () => {
    const f = valid();
    f.data.templates = [];
    expect(parse(f)).toMatchObject({ ok: false, error: expect.stringContaining('has no character') });
  });

  it('reports the path of a wrongly typed field', () => {
    const f = valid() as unknown as { data: { encounters: { combatants: { name: unknown }[] }[] } };
    f.data.encounters[0].combatants[0].name = 42;
    expect(parse(f)).toMatchObject({ ok: false, error: expect.stringContaining('data.encounters[0].combatants[0].name') });
  });

  it('accepts exports made before conditions had rules text or a per-turn flag', () => {
    const f = valid() as unknown as {
      data: {
        customConditions: Record<string, unknown>[];
        encounters: { combatants: { conditions: Record<string, unknown>[] }[] }[];
      };
    };
    const bleeding = f.data.customConditions[0];
    delete bleeding.effect;
    delete bleeding.endsWhen;
    delete bleeding.repeatsSave;
    const onCombatant = f.data.encounters[0].combatants[0].conditions;
    delete onCombatant[0].requiresResolve;
    onCombatant.push({ instanceId: 'i2', conditionId: 'dnd5e:paralyzed', name: 'Paralyzed', resolvedThisTurn: false });
    const parsed = parse(f);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.file.data.customConditions[0]).toMatchObject({ effect: '', repeatsSave: false });
    // Custom without the flag → no per-turn save; built-in Paralyzed → its default (yes).
    expect(parsed.file.data.encounters[0].combatants[0].conditions.map((c) => c.requiresResolve)).toEqual([false, true]);
  });

  it('accepts version 1 exports: no encounter format, 5e death save fields, no condition values', () => {
    type Raw = Record<string, unknown>;
    const f = valid() as unknown as {
      schemaVersion: number;
      data: { encounters: (Raw & { combatants: (Raw & { conditions: Raw[] })[] })[] };
    };
    f.schemaVersion = 1;
    const enc = f.data.encounters[0];
    delete enc.formatId;
    const c = enc.combatants[0];
    c.status = 'dying';
    c.deathSaves = { successes: 2, failures: 1 };
    c.deathSaveMadeThisTurn = true;
    delete c.dying;
    delete c.dyingRollMadeThisTurn;
    const cond = c.conditions[0];
    delete cond.value;
    delete cond.dropsEachTurn;
    const parsed = parse(f);
    if (!parsed.ok) throw new Error(parsed.error);
    const read = parsed.file.data.encounters[0];
    expect(read.formatId).toBe('dnd5e');
    expect(read.combatants[0]).toMatchObject({ dying: { successes: 2, failures: 1, value: 0 }, dyingRollMadeThisTurn: true });
    expect(read.combatants[0].conditions[0]).toMatchObject({ value: null, dropsEachTurn: false });
  });

  it('rejects a combatant whose character has a different format than the encounter', () => {
    const f = valid();
    f.data.templates = f.data.templates.map((t) => ({ ...t, formatId: 'dnd5e2024' }));
    expect(parse(f)).toMatchObject({ ok: false, error: expect.stringContaining('different format') });
  });

  it('clamps out-of-range numbers and fills missing stat block fields', () => {
    const f = valid() as unknown as { data: { templates: { statBlock: Record<string, unknown> }[] } };
    f.data.templates[0].statBlock = { armorClass: 9999, abilities: { str: 50 } };
    const parsed = parse(f);
    if (!parsed.ok) throw new Error(parsed.error);
    const sb = parsed.file.data.templates[0].statBlock as Dnd5eStatBlock;
    expect(sb.armorClass).toBe(50);
    expect(sb.abilities.str).toBe(30);
    expect(sb.abilities.dex).toBe(10);
  });
});

describe('Lorekeeper links', () => {
  it('a character made from a Lorekeeper page keeps the link through export and import', () => {
    const carian: CharacterTemplate = { ...hero, id: 'carian', name: 'Carian', kind: 'npc', deathSaves: false, lore: { notebookId: 'nb', pageId: 'p-carian' } };
    const file = roundTrip('characters', exportCharacters({ ...empty(), templates: [carian] }, ['carian']));
    expect(file.data.templates[0].lore).toEqual({ notebookId: 'nb', pageId: 'p-carian' });
  });

  it('characters without one stay without one', () => {
    const file = roundTrip('characters', exportCharacters({ ...empty(), templates: [hero] }, ['hero']));
    expect('lore' in file.data.templates[0]).toBe(false);
  });

  it('rejects a damaged link', () => {
    const bad = { ...hero, lore: { notebookId: 'nb' } } as unknown as CharacterTemplate;
    expect(() => roundTrip('characters', exportCharacters({ ...empty(), templates: [bad] }, ['hero']))).toThrow('lore.pageId');
  });
});
