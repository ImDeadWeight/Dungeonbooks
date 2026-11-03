/**
 * @file The notebook model: nested folders, named pages, and the free-floating
 * text boxes on each page, plus pure tree helpers.
 */
import type { JSONContent } from '@tiptap/core';
import type { SharedStatBlock } from 'campaign-link';
import type { Id } from './ids';

/** A folder in the sidebar tree. parentId null = top level. */
export interface Folder {
  id: Id;
  name: string;
  parentId: Id | null;
  /** Position among the folders beside it, lowest first. Absent until the user arranges them (then they sort by name). */
  order?: number;
}

/** A text box placed on a page's canvas. Position and width are in canvas pixels. */
export interface TextBox {
  id: Id;
  x: number;
  y: number;
  width: number;
  /** Rich text as the editor's JSON document. */
  content: JSONContent;
}

/** Player character or non-player character (the same split Encounters makes). */
export type CharacterKind = 'pc' | 'npc';

/**
 * What a page describes, with the fields that kind of page needs. A page
 * without info is a plain note. Encounters reads characters and places.
 */
export type PageInfo =
  | { type: 'character'; kind: CharacterKind }
  /** parentPlaceId: the place this one is inside (Fort Talbot inside Aurelane), or null. */
  | { type: 'place'; parentPlaceId: Id | null }
  | { type: 'faction' }
  | { type: 'item' };

/** Every kind of page, including the plain note. */
export type PageType = 'note' | PageInfo['type'];

/** Page types in menu order, with their labels. */
export const PAGE_TYPES: { type: PageType; label: string }[] = [
  { type: 'note', label: 'Note' },
  { type: 'character', label: 'Character' },
  { type: 'place', label: 'Place' },
  { type: 'faction', label: 'Faction' },
  { type: 'item', label: 'Item' },
];

/** A named note page. Its title is what other pages' text is matched against for links. */
export interface Page {
  id: Id;
  title: string;
  folderId: Id | null;
  boxes: TextBox[];
  /** Absent for plain notes. */
  info?: PageInfo;
  /** Character pages: the character's stat block (the same shapes as Encounters'); absent until one is added. */
  statBlock?: SharedStatBlock;
}

/** A page's type ('note' when it has none). */
export function pageType(page: Pick<Page, 'info'>): PageType {
  return page.info?.type ?? 'note';
}

/**
 * Info for a page changing to `type`. Keeps the page's current fields when
 * the type doesn't change (a place keeps its parent); otherwise starts from
 * defaults (a character starts as an NPC). Undefined means a plain note.
 */
export function infoForType(type: PageType, current?: PageInfo): PageInfo | undefined {
  if (current?.type === type) return current;
  switch (type) {
    case 'note':
      return undefined;
    case 'character':
      return { type, kind: 'npc' };
    case 'place':
      return { type, parentPlaceId: null };
    default:
      return { type };
  }
}

/** The place a place page sits inside, if that page still exists and is still a place. */
export function parentPlace(pages: Page[], page: Page): Page | null {
  if (page.info?.type !== 'place' || !page.info.parentPlaceId) return null;
  const parent = pages.find((p) => p.id === (page.info as { parentPlaceId: Id }).parentPlaceId);
  return parent?.info?.type === 'place' ? parent : null;
}

/** Ids of every place nested (at any depth) inside the given place, not including it. */
export function descendantPlaceIds(pages: Page[], placeId: Id): Id[] {
  const result: Id[] = [];
  const queue = [placeId];
  while (queue.length) {
    const parent = queue.shift()!;
    for (const p of pages) {
      if (p.info?.type === 'place' && p.info.parentPlaceId === parent && !result.includes(p.id)) {
        result.push(p.id);
        queue.push(p.id);
      }
    }
  }
  return result;
}

/** Places a place could be put inside: every other place except those inside it (which would make a loop). */
export function placeParentOptions(pages: Page[], placeId: Id): Page[] {
  const blocked = new Set([placeId, ...descendantPlaceIds(pages, placeId)]);
  return pages.filter((p) => p.info?.type === 'place' && !blocked.has(p.id)).sort((a, b) => byName(a.title, b.title));
}

/** Everything that is saved. */
export interface Notebook {
  folders: Folder[];
  pages: Page[];
}

/** A fresh, empty notebook. */
export function emptyNotebook(): Notebook {
  return { folders: [], pages: [] };
}

/** Sidebar order: alphabetical, numbers compared as numbers ("Session 2" before "Session 10"). */
export function byName(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Sidebar order for folders: as the user arranged them, then any never arranged by name. */
export function byFolderOrder(a: Folder, b: Folder): number {
  const ao = a.order ?? Infinity;
  const bo = b.order ?? Infinity;
  return ao !== bo ? ao - bo : byName(a.name, b.name);
}

/**
 * Moves a folder into `parentId` at position `index` among the folders there
 * (counted without the moved one), and renumbers that level so the whole
 * arrangement sticks.
 */
export function placeFolder(folders: Folder[], id: Id, parentId: Id | null, index: number): Folder[] {
  const moved = folders.find((f) => f.id === id);
  if (!moved) return folders;
  const level = folders.filter((f) => f.parentId === parentId && f.id !== id).sort(byFolderOrder);
  level.splice(Math.max(0, Math.min(index, level.length)), 0, { ...moved, parentId });
  const placed = new Map(level.map((f, i) => [f.id, { ...f, order: i }]));
  return folders.map((f) => placed.get(f.id) ?? f);
}

/** Ids of every folder nested (at any depth) inside the given folder, not including it. */
export function descendantFolderIds(folders: Folder[], folderId: Id): Id[] {
  const result: Id[] = [];
  const queue = [folderId];
  while (queue.length) {
    const parent = queue.shift()!;
    for (const f of folders) {
      if (f.parentId === parent) {
        result.push(f.id);
        queue.push(f.id);
      }
    }
  }
  return result;
}

/** A folder can move to the top level or into any folder except itself and its own sub-folders. */
export function canMoveFolder(folders: Folder[], folderId: Id, newParentId: Id | null): boolean {
  if (newParentId === null) return true;
  return newParentId !== folderId && !descendantFolderIds(folders, folderId).includes(newParentId);
}

/** What the sidebar shows while searching. */
export interface TreeFilter {
  /** Folders and pages to show: matches, the folders above them, and everything inside a matching folder. */
  visible: Set<Id>;
  /** Folders opened because a match is inside them. */
  opened: Set<Id>;
}

/**
 * Narrows the sidebar tree to a search: folders and pages whose names contain
 * the text (ignoring case), the folders above them, and everything inside a
 * matching folder. Null when the search is blank.
 */
export function filterTree(folders: Folder[], pages: Page[], query: string): TreeFilter | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const parentOf = new Map(folders.map((f) => [f.id, f.parentId]));
  const matchingFolders = new Set(folders.filter((f) => f.name.toLowerCase().includes(q)).map((f) => f.id));
  // The folders above an item, nearest first (bounded in case of a parent loop).
  const above = (parentId: Id | null) => {
    const chain: Id[] = [];
    for (let id = parentId; id !== null && parentOf.has(id) && chain.length < folders.length; id = parentOf.get(id)!) chain.push(id);
    return chain;
  };
  const visible = new Set<Id>();
  const opened = new Set<Id>();
  const consider = (id: Id, parentId: Id | null, name: string) => {
    const chain = above(parentId);
    if (name.toLowerCase().includes(q)) {
      visible.add(id);
      for (const f of chain) {
        visible.add(f);
        opened.add(f);
      }
    } else if (chain.some((f) => matchingFolders.has(f))) {
      visible.add(id);
    }
  };
  for (const f of folders) consider(f.id, f.parentId, f.name);
  for (const p of pages) consider(p.id, p.folderId, p.title);
  return { visible, opened };
}

/** Inline items that count as content although they hold no text (an encounter link chip). */
const CONTENT_ATOMS = new Set(['encounterLink']);

/** True when a box holds no text or chips (such boxes are discarded when they lose focus). */
export function isEmptyContent(content: JSONContent): boolean {
  const hasContent = (node: JSONContent): boolean =>
    (node.type === 'text' && !!node.text?.trim()) || CONTENT_ATOMS.has(node.type ?? '') || (node.content ?? []).some(hasContent);
  return !hasContent(content);
}
