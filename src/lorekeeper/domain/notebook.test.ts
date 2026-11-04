import { describe, expect, it } from 'vitest';
import {
  byFolderOrder,
  canNestPage,
  descendantPageIds,
  filterTree,
  groupOptions,
  groupsOf,
  membersOf,
  pagesInFolders,
  isEmptyContent,
  descendantPlaceIds,
  infoForType,
  pageType,
  parentPlace,
  placeFolder,
  placeParentOptions,
  type Folder,
  type Page,
} from './notebook';

/** Names of the folders in a level, in sidebar order. */
const level = (folders: Folder[], parentId: string | null) =>
  folders.filter((f) => f.parentId === parentId).sort(byFolderOrder).map((f) => f.name);

const folders: Folder[] = [
  { id: 'p', name: 'Places', parentId: null },
  { id: 'f', name: 'Factions', parentId: null },
  { id: 'c', name: 'Characters', parentId: null },
  { id: 'v', name: 'Vaultrock', parentId: 'p' },
];

describe('folder order', () => {
  it('is alphabetical until arranged', () => {
    expect(level(folders, null)).toEqual(['Characters', 'Factions', 'Places']);
  });

  it('puts arranged folders first, then the rest by name', () => {
    const mixed = folders.map((f) => (f.id === 'p' ? { ...f, order: 0 } : f));
    expect(level(mixed, null)).toEqual(['Places', 'Characters', 'Factions']);
  });
});

describe('placing a folder', () => {
  it('reorders within a level and keeps the whole arrangement', () => {
    const placed = placeFolder(folders, 'p', null, 0);
    expect(level(placed, null)).toEqual(['Places', 'Characters', 'Factions']);
    expect(placed.filter((f) => f.parentId === null).every((f) => f.order !== undefined)).toBe(true);
  });

  it('moves a folder to another level at the given position', () => {
    const placed = placeFolder(folders, 'v', null, 1);
    expect(level(placed, null)).toEqual(['Characters', 'Vaultrock', 'Factions', 'Places']);
    expect(level(placed, 'p')).toEqual([]);
  });

  it('clamps positions past the end', () => {
    expect(level(placeFolder(folders, 'c', null, 99), null)).toEqual(['Factions', 'Places', 'Characters']);
  });
});

/** A page with only what these tests need. */
const page = (id: string, info?: Page['info']): Page => ({ id, title: id, folderId: null, boxes: [], ...(info ? { info } : {}) });

describe('page types', () => {
  it('treats a page without info as a note', () => {
    expect(pageType(page('x'))).toBe('note');
    expect(pageType(page('x', { type: 'item' }))).toBe('item');
  });

  it('keeps fields when the type stays the same, and uses defaults when it changes', () => {
    const place = { type: 'place' as const, parentPlaceId: 'aurelane' };
    expect(infoForType('place', place)).toBe(place);
    expect(infoForType('character', place)).toEqual({ type: 'character', kind: 'npc' });
    expect(infoForType('note', place)).toBeUndefined();
  });
});

describe('places', () => {
  const pages = [
    page('Veilstrand', { type: 'place', parentPlaceId: null }),
    page('Aurelane', { type: 'place', parentPlaceId: 'Veilstrand' }),
    page('Fort Talbot', { type: 'place', parentPlaceId: 'Aurelane' }),
    page('Ashmere', { type: 'place', parentPlaceId: 'Veilstrand' }),
    page('Carian', { type: 'character', kind: 'npc' }),
  ];

  it('finds a place and everything inside it', () => {
    expect(parentPlace(pages, pages[2])?.id).toBe('Aurelane');
    expect(descendantPlaceIds(pages, 'Veilstrand').sort()).toEqual(['Ashmere', 'Aurelane', 'Fort Talbot']);
  });

  it('never offers a place, or anything inside it, as its own parent', () => {
    expect(placeParentOptions(pages, 'Aurelane').map((p) => p.id)).toEqual(['Ashmere', 'Veilstrand']);
  });

  it('ignores a parent that is no longer a place', () => {
    const orphan = page('Pit', { type: 'place', parentPlaceId: 'Carian' });
    expect(parentPlace([...pages, orphan], orphan)).toBeNull();
  });
});

describe('empty boxes', () => {
  const paragraph = (...content: object[]) => ({ type: 'doc', content: [{ type: 'paragraph', content }] });

  it('treats whitespace-only text as empty', () => {
    expect(isEmptyContent(paragraph({ type: 'text', text: '   ' }))).toBe(true);
    expect(isEmptyContent({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
  });

  it('keeps a box holding only an encounter link', () => {
    expect(isEmptyContent(paragraph({ type: 'encounterLink', attrs: { encounterId: 'e1', name: 'Pit brawl' } }))).toBe(false);
  });
});

describe('sidebar search', () => {
  // Places › Vaultrock holds "Old Mill"; Characters holds "Mira"; "Harbor" is at the top level.
  const pages: Page[] = [
    { id: 'mill', title: 'Old Mill', folderId: 'v', boxes: [] },
    { id: 'mira', title: 'Mira', folderId: 'c', boxes: [] },
    { id: 'harbor', title: 'Harbor', folderId: null, boxes: [] },
  ];
  const visible = (query: string) => [...(filterTree(folders, pages, query)?.visible ?? [])].sort();

  it('is off for a blank search', () => {
    expect(filterTree(folders, pages, '  ')).toBeNull();
  });

  it('shows a matching page with the folders above it, opened', () => {
    const filter = filterTree(folders, pages, 'MILL')!;
    expect([...filter.visible].sort()).toEqual(['mill', 'p', 'v']);
    expect([...filter.opened].sort()).toEqual(['p', 'v']);
  });

  it('shows everything inside a matching folder without opening it', () => {
    const filter = filterTree(folders, pages, 'places')!;
    expect([...filter.visible].sort()).toEqual(['mill', 'p', 'v']);
    expect(filter.opened.size).toBe(0);
  });

  it('matches parts of names across folders and pages', () => {
    expect(visible('ar')).toEqual(['c', 'harbor', 'mira']);
    expect(visible('zzz')).toEqual([]);
  });
});

describe('pages under pages', () => {
  // Vaultrock (in folder v) holds The Mines, which holds Shaft 3. Harbor is at the top level.
  const tree: Page[] = [
    { id: 'vaultrock', title: 'Vaultrock', folderId: 'v', boxes: [] },
    { id: 'mines', title: 'The Mines', folderId: null, parentPageId: 'vaultrock', boxes: [] },
    { id: 'shaft', title: 'Shaft 3', folderId: null, parentPageId: 'mines', boxes: [] },
    { id: 'harbor', title: 'Harbor', folderId: null, boxes: [] },
  ];

  it('finds every page under a page', () => {
    expect(descendantPageIds(tree, 'vaultrock')).toEqual(['mines', 'shaft']);
    expect(pagesInFolders(tree, new Set(['v'])).sort()).toEqual(['mines', 'shaft', 'vaultrock']);
  });

  it("won't put a page under itself", () => {
    expect(canNestPage(tree, 'vaultrock', 'shaft')).toBe(false);
    expect(canNestPage(tree, 'vaultrock', 'vaultrock')).toBe(false);
    expect(canNestPage(tree, 'shaft', 'harbor')).toBe(true);
  });

  it('searches through pages, opening the ones above a match', () => {
    const filter = filterTree(folders, tree, 'shaft')!;
    expect([...filter.visible].sort()).toEqual(['mines', 'p', 'shaft', 'v', 'vaultrock']);
    expect([...filter.opened].sort()).toEqual(['mines', 'p', 'v', 'vaultrock']);
  });

  it('shows everything under a matching page', () => {
    expect([...filterTree(folders, tree, 'mines')!.visible].sort()).toEqual(['mines', 'p', 'shaft', 'v', 'vaultrock']);
  });
});

describe('where characters belong', () => {
  const pages: Page[] = [
    page('Vaultrock', { type: 'place', parentPlaceId: null }),
    page('Blood Clan', { type: 'faction' }),
    page('Mask', { type: 'item' }),
    page('Bongo', { type: 'character', kind: 'npc', belongsTo: ['Vaultrock', 'Mask'] }),
    page('Danny', { type: 'character', kind: 'npc', belongsTo: ['Vaultrock', 'Blood Clan'] }),
  ];
  const titles = (list: Page[]) => list.map((p) => p.title);

  it('lists the places and factions a character belongs to, ignoring other pages', () => {
    expect(titles(groupsOf(pages, pages[3]))).toEqual(['Vaultrock']);
    expect(titles(groupOptions(pages, pages[3]))).toEqual(['Blood Clan']);
  });

  it("lists a place's characters", () => {
    expect(titles(membersOf(pages, 'Vaultrock'))).toEqual(['Bongo', 'Danny']);
    expect(titles(membersOf(pages, 'Blood Clan'))).toEqual(['Danny']);
  });
});
