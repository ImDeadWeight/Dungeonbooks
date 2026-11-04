import { describe, expect, it } from 'vitest';
import { createEmptyStatBlock } from 'campaign-link/formats/dnd5e/statBlock';
import type { CharacterTemplate } from '../characters';
import { crValue, EMPTY_COMPENDIUM_FILTER, entryTypes, filterEntries, findCopy, templateFromEntry } from './fromCompendium';
import type { CompendiumEntry } from './types';

const entry = (id: string, name: string, cr: string, type: string): CompendiumEntry => ({ id, name, cr, type, statBlock: createEmptyStatBlock() });
const goblin = entry('goblin', 'Goblin', '1/4', 'humanoid');
const ogre = entry('ogre', 'Ogre', '2', 'giant');
const dragon = entry('red-dragon', 'Red Dragon', '17', 'dragon');
const all = [dragon, goblin, ogre];

describe('compendium creatures in the library', () => {
  it('copies a creature as an NPC tagged SRD, remembering where it came from', () => {
    const t = templateFromEntry(goblin, 'dnd5e', 'tag-srd', 'id-1');
    expect(t).toMatchObject({ id: 'id-1', name: 'Goblin', kind: 'npc', formatId: 'dnd5e', tagIds: ['tag-srd'], compendiumId: 'goblin', deathSaves: false });
  });

  it('finds an existing copy only in the same format', () => {
    const t = templateFromEntry(goblin, 'dnd5e', 'tag', 'id-1');
    const templates: CharacterTemplate[] = [t];
    expect(findCopy(templates, 'dnd5e', 'goblin')).toBe(t);
    expect(findCopy(templates, 'dnd5e2024', 'goblin')).toBeUndefined();
  });
});

describe('searching the compendium', () => {
  it('reads fractional CRs', () => {
    expect([crValue('1/8'), crValue('1/2'), crValue('10')]).toEqual([0.125, 0.5, 10]);
  });

  it('filters by name, CR range and type', () => {
    expect(filterEntries(all, { ...EMPTY_COMPENDIUM_FILTER, query: 'gob' })).toEqual([goblin]);
    expect(filterEntries(all, { ...EMPTY_COMPENDIUM_FILTER, minCr: 0.25, maxCr: 2 })).toEqual([goblin, ogre]);
    expect(filterEntries(all, { ...EMPTY_COMPENDIUM_FILTER, type: 'dragon' })).toEqual([dragon]);
  });

  it('lists the creature types', () => {
    expect(entryTypes(all)).toEqual(['dragon', 'giant', 'humanoid']);
  });
});
