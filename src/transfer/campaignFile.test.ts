/**
 * @file Tests for campaign files: an exact round trip of both halves, what
 * gets refused, telling file kinds apart, how the notes go with the
 * campaign's choice, and links surviving a copy.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterTemplate } from '../encounters/domain/characters';
import { inactiveCombat, noDyingProgress } from '../encounters/domain/combat/types';
import { applyImport } from '../encounters/domain/transfer/applyImport';
import { exportCampaign } from '../encounters/domain/transfer/exportBundle';
import { itemKey, type Resolution } from '../encounters/domain/transfer/plan';
import type { AppData } from '../encounters/domain/transfer/types';
import { renameEncounterLinks } from '../lorekeeper/domain/encounterLinks';
import { NOTEBOOK_FORMAT, type Notebook, type Page } from '../lorekeeper/domain/notebook';
import { campaignFileName, campaignFileText, type CampaignFile } from './campaignFile';
import { notesAction, notesStatus, pageCounts, planCampaignImport } from './campaignPlan';
import { importFileKind } from './fileKind';
import { parseCampaignFile } from './parseCampaignFile';

const IMAGE = `${'a'.repeat(64)}.png`;

const mira: CharacterTemplate = {
  id: 'mira', name: 'Mira', kind: 'npc', formatId: 'dnd5e', tagIds: [], deathSaves: false, statBlock: null,
  lore: { notebookId: 'c1', pageId: 'p-mira' },
};

/** One campaign with a party, an area, an encounter with Mira in it. */
function state(): AppData {
  return {
    campaigns: [{ id: 'c1', name: 'Veilstrand', formatId: 'dnd5e', party: { size: 4, level: 3 } }],
    areas: [{ id: 'a1', name: 'Harbour', campaignId: 'c1', parentAreaId: null }],
    encounters: [{
      id: 'e1', name: 'Dock brawl', campaignId: 'c1', areaId: 'a1', formatId: 'dnd5e', combat: inactiveCombat(),
      combatants: [{
        id: 'k1', templateId: 'mira', name: 'Mira', maxHp: 9, currentHp: 9, tempHp: 0, initiative: null, addedOrder: 0,
        tokenDescription: '', side: '', status: 'active', dying: noDyingProgress(),
        dyingRollMadeThisTurn: false, conditions: [],
      }],
    }],
    templates: [mira],
    tags: [],
    customConditions: [],
  };
}

const page = (id: string, title: string, text = ''): Page => ({
  id, title, folderId: null,
  boxes: [{ id: `b-${id}`, x: 0, y: 0, width: 400, content: { type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] } }],
});

/** Notes with Mira's page and a page linking to the encounter. */
const notes = (): Notebook => ({
  format: NOTEBOOK_FORMAT,
  folders: [],
  pages: [
    page('p-mira', 'Mira Thorne', 'A smuggler.'),
    {
      ...page('p-docks', 'The docks'),
      boxes: [{ id: 'b-docks', x: 0, y: 0, width: 400, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'encounterLink', attrs: { encounterId: 'e1', name: 'Dock brawl' } }] }] } }],
    },
  ],
});

/** Export → text → read, as a real file travels. */
function roundTrip(images = {}): CampaignFile {
  const s = state();
  const result = parseCampaignFile(campaignFileText(s.campaigns[0], exportCampaign(s, 'c1'), notes(), images));
  if (!result.ok) throw new Error(result.error);
  return result.file;
}

describe('campaign files', () => {
  it('carry the campaign, its encounters and its notes exactly', () => {
    const file = roundTrip({ [IMAGE]: 'iVBORw==' });
    expect(file.campaign).toEqual(state().campaigns[0]);
    expect(file.encounters.data).toEqual(exportCampaign(state(), 'c1'));
    expect(file.notes).toEqual(notes());
    expect(file.images).toEqual({ [IMAGE]: 'iVBORw==' });
  });

  it('are named after the campaign', () => {
    expect(campaignFileName('Veil: "Storm"?')).toBe('Veil Storm.dungeonbooks.json');
    expect(campaignFileName('???')).toBe('campaign.dungeonbooks.json');
  });

  it('refuse newer versions, broken encounters and broken notes', () => {
    const json = () => JSON.parse(campaignFileText(state().campaigns[0], exportCampaign(state(), 'c1'), notes(), {}));
    const read = (o: unknown) => parseCampaignFile(JSON.stringify(o));
    expect(read({ ...json(), schemaVersion: 99 })).toMatchObject({ ok: false, error: expect.stringContaining('newer version') });
    const noCharacter = json();
    noCharacter.encounters.templates = [];
    expect(read(noCharacter)).toMatchObject({ ok: false, error: expect.stringContaining('has no character in the file') });
    const badNotes = json();
    badNotes.notes.pages = [{ title: 'no id' }];
    expect(read(badNotes)).toMatchObject({ ok: false, error: 'notes: page 1 is damaged' });
    expect(parseCampaignFile('nope')).toEqual({ ok: false, error: 'the file is not valid JSON' });
  });

  it('are told apart from Encounters exports and notes', () => {
    expect(importFileKind({ app: 'dungeon-books' })).toBe('campaign');
    expect(importFileKind({ app: 'encounters' })).toBe('encounters');
    expect(importFileKind({ format: 'lorekeeper-notebook' })).toBe('notes');
    expect(importFileKind({ version: 2, data: {} })).toBe('notes');
    expect(importFileKind({ hello: 1 })).toBe(null);
    expect(importFileKind([])).toBe(null);
  });
});

describe('importing a campaign file', () => {
  const fresh = (): AppData => ({ campaigns: [], areas: [], encounters: [], templates: [], tags: [], customConditions: [] });

  it('brings a campaign that is not here in whole, with its own ids', () => {
    const file = roundTrip();
    const status = notesStatus(null, file.notes);
    const plan = planCampaignImport(file, fresh(), status);
    expect(notesAction(file, plan, {}, status)).toBe('add');
    const { data, finalId } = applyImport(fresh(), file.encounters, plan, {}, { campaignId: 'c1', areaId: null }, { withNotes: true });
    expect(data).toEqual(state());
    expect(finalId('campaign', 'c1')).toBe('c1');
  });

  it('counts pages and leaves identical notes alone', () => {
    const file = roundTrip();
    const changed = { ...notes(), pages: [page('p-mira', 'Mira Thorne', 'A spy.'), page('p-new', 'New')] };
    expect(pageCounts(changed, file.notes)).toEqual({ new: 1, identical: 0, conflict: 1 });
    expect(notesStatus(notes(), file.notes)).toBe('identical');
    const plan = planCampaignImport(file, state(), 'identical');
    expect(plan.items.find((i) => i.type === 'campaign')?.status).toBe('identical');
    expect(notesAction(file, plan, {}, 'identical')).toBe('skip');
  });

  it('fills a campaign here that has no notes yet', () => {
    const file = roundTrip();
    const status = notesStatus({ folders: [], pages: [] }, file.notes);
    expect(status).toBe('new');
    expect(notesAction(file, planCampaignImport(file, state(), status), {}, status)).toBe('add');
  });

  it('lets the campaign’s choice decide when its notes differ', () => {
    const file = roundTrip();
    const here = { ...notes(), pages: [page('p-mira', 'Mira Thorne', 'A spy.')] };
    const status = notesStatus(here, file.notes);
    expect(status).toBe('conflict');
    // The campaign itself is unchanged, but its notes make it a conflict.
    const plan = planCampaignImport(file, state(), status);
    const key = itemKey('campaign', 'c1');
    expect(plan.items.find((i) => i.key === key)?.status).toBe('conflict');
    const choose = (r: Resolution) => notesAction(file, plan, { [key]: r }, status);
    expect(notesAction(file, plan, {}, status)).toBe('skip');
    expect(choose('mine')).toBe('skip');
    expect(choose('theirs')).toBe('replace');
    expect(choose('both')).toBe('copy');
  });

  it('keeps links working in a copy: notes point at the copied encounters, characters at the copy’s pages', () => {
    const file = roundTrip();
    const here = { ...notes(), pages: [page('p-mira', 'Mira Thorne', 'A spy.')] };
    // Mira's character differs here, and is copied too.
    const mine = { ...state(), templates: [{ ...mira, name: 'Mira (old)' }] };
    const plan = planCampaignImport(file, mine, notesStatus(here, file.notes));
    const resolutions = { [itemKey('campaign', 'c1')]: 'both', [itemKey('character', 'mira')]: 'both' } as const;
    const { data, finalId } = applyImport(mine, file.encounters, plan, resolutions, { campaignId: 'c1', areaId: null }, { withNotes: true });

    const copy = finalId('campaign', 'c1');
    expect(copy).not.toBe('c1');
    expect(data.campaigns.map((c) => c.name)).toEqual(['Veilstrand', 'Veilstrand (imported)']);
    const copiedMira = data.templates.find((t) => t.id === finalId('character', 'mira'))!;
    expect(copiedMira.lore).toEqual({ notebookId: copy, pageId: 'p-mira' });

    const linked = renameEncounterLinks(file.notes, (id) => finalId('encounter', id));
    const chip = linked.pages[1].boxes[0].content.content![0].content![0];
    expect(chip.attrs?.encounterId).toBe(finalId('encounter', 'e1'));
    expect(data.encounters.some((e) => e.id === chip.attrs?.encounterId && e.campaignId === copy)).toBe(true);
    // Pages without links are left as they were.
    expect(linked.pages[0]).toBe(file.notes.pages[0]);
  });

  it('leaves characters pointing at the notes here when the file has no notes for them', () => {
    const file = roundTrip();
    const resolutions = { [itemKey('campaign', 'c1')]: 'both', [itemKey('character', 'mira')]: 'both' } as const;
    const mine = { ...state(), campaigns: [{ ...state().campaigns[0], name: 'Other' }], templates: [{ ...mira, name: 'Mira (old)' }] };
    const plan = planCampaignImport(file, mine, 'identical');
    const { data, finalId } = applyImport(mine, file.encounters, plan, resolutions, { campaignId: 'c1', areaId: null });
    expect(data.templates.find((t) => t.id === finalId('character', 'mira'))?.lore?.notebookId).toBe('c1');
  });
});
