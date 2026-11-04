import { describe, expect, it } from 'vitest';
import { NOTEBOOK_FORMAT, type Folder, type Notebook, type Page } from './notebook';
import { upgradeNotebook } from './upgrade';

const folder = (id: string, name: string, parentId: string | null = null): Folder => ({ id, name, parentId });
const page = (id: string, title: string, folderId: string | null, info?: Page['info']): Page => ({
  id,
  title,
  folderId,
  boxes: [],
  ...(info ? { info } : {}),
});
const place = { type: 'place' as const, parentPlaceId: null };
const npc = { type: 'character' as const, kind: 'npc' as const };

// Places › Islands › Vaultrock holds the Vaultrock page and two more; Small Islands has no page of its own.
// Characters › Vaultrock and Characters › Unaffiliated hold characters.
const old: Notebook = {
  folders: [
    folder('places', 'Places'),
    folder('islands', 'Islands', 'places'),
    folder('vaultrock', 'Vaultrock', 'islands'),
    folder('small', 'Small Islands', 'islands'),
    folder('chars', 'Characters'),
    folder('charsVault', 'Vaultrock', 'chars'),
    folder('unaffiliated', 'Unaffiliated', 'chars'),
  ],
  pages: [
    page('vaultrockPage', 'Vaultrock', 'vaultrock', place),
    page('pit', 'Gladiator Pit', 'vaultrock', place),
    page('mines', 'The Mines', 'vaultrock', place),
    page('kelmoor', 'Kelmoor', 'small', place),
    page('bongo', 'Bongo', 'charsVault', npc),
    page('osric', 'Osric Penhallow', 'unaffiliated', npc),
  ],
};

describe('upgrading to child pages', () => {
  const upgraded = upgradeNotebook(old);
  const byId = Object.fromEntries(upgraded.pages.map((p) => [p.id, p]));

  it('replaces a folder holding a page of its name with that page, the rest under it', () => {
    expect(upgraded.folders.map((f) => f.id)).not.toContain('vaultrock');
    expect(byId.vaultrockPage.folderId).toBe('islands');
    expect(byId.vaultrockPage.parentPageId).toBeUndefined();
    expect(byId.pit).toMatchObject({ folderId: null, parentPageId: 'vaultrockPage' });
    expect(byId.mines).toMatchObject({ folderId: null, parentPageId: 'vaultrockPage' });
  });

  it('leaves folders without a page of their own name', () => {
    expect(upgraded.folders.map((f) => f.id)).toEqual(['places', 'islands', 'small', 'chars', 'charsVault', 'unaffiliated']);
    expect(byId.kelmoor.folderId).toBe('small');
  });

  it('lets characters belong to the place or faction their folder is named after', () => {
    expect(byId.bongo.info).toEqual({ ...npc, belongsTo: ['vaultrockPage'] });
    expect(byId.bongo.folderId).toBe('charsVault');
    expect(byId.osric.info).toEqual(npc);
  });

  it('marks the notebook upgraded, and leaves a current one alone', () => {
    expect(upgraded.format).toBe(NOTEBOOK_FORMAT);
    expect(upgradeNotebook(upgraded)).toBe(upgraded);
  });

  it('keeps folders that have sub-folders, and names matching two pages', () => {
    const notebook: Notebook = {
      folders: [folder('a', 'Aurelane'), folder('towns', 'Towns', 'a'), folder('b', 'Twins')],
      pages: [page('aPage', 'Aurelane', 'a'), page('t1', 'Twins', 'b'), page('t2', 'twins', 'b')],
    };
    const result = upgradeNotebook(notebook);
    expect(result.folders).toHaveLength(3);
    expect(result.pages.every((p) => !p.parentPageId)).toBe(true);
  });
});
