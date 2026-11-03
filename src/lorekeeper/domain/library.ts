/**
 * @file The notebook library: which notebooks exist and which is open, plus
 * the exported-notebook file format (writing it, and reading it back safely).
 */
import { readSharedStatBlock } from 'campaign-link';
import type { Id } from './ids';
import type { Folder, Notebook, Page, PageInfo, TextBox } from './notebook';

/** A notebook's entry in the library. Its id also names the notebook's file. */
export interface NotebookInfo {
  id: Id;
  name: string;
}

/** Every notebook, and the one that is open. */
export interface Library {
  notebooks: NotebookInfo[];
  activeId: Id | null;
}

/** Name of the first notebook (including one adopted from before there were several). */
export const DEFAULT_NOTEBOOK_NAME = 'My notebook';
/** Name given to notebooks created with the New notebook button. */
export const NEW_NOTEBOOK_NAME = 'New notebook';

/** A library with no notebooks yet. */
export function emptyLibrary(): Library {
  return { notebooks: [], activeId: null };
}

/** `wanted`, or `wanted (2)`, `wanted (3)`… whichever no notebook is using yet (ignoring case). */
export function uniqueName(taken: string[], wanted: string): string {
  const used = new Set(taken.map((n) => n.trim().toLowerCase()));
  let name = wanted;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${wanted} (${i})`;
  return name;
}

/** Marks an exported file as a Lorekeeper notebook. */
const EXPORT_FORMAT = 'lorekeeper-notebook';
/** Version written into exports; files from newer versions are refused. */
const EXPORT_VERSION = 1;

/** An exported notebook: one self-contained file. */
export interface NotebookExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  name: string;
  notebook: Notebook;
}

/** The text of an export file for a notebook. */
export function exportText(name: string, notebook: Notebook): string {
  const file: NotebookExport = { format: EXPORT_FORMAT, version: EXPORT_VERSION, name, notebook };
  return JSON.stringify(file, null, 2);
}

/** A file name for an exported notebook, with characters Windows forbids removed. */
export function exportFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const safe = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/[. ]+$/, '').trim();
  return `${safe || 'notebook'}.json`;
}

/** An imported notebook, ready to add to the library. */
export interface ImportedNotebook {
  name: string;
  notebook: Notebook;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Reads an export file. Also accepts a raw saved notebook (the app's own
 * notebook.json), named after `fallbackName`. Throws an Error with a readable
 * message when the file isn't a notebook.
 */
export function parseNotebookFile(text: string, fallbackName: string): ImportedNotebook {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('the file is not valid JSON');
  }
  if (!isObject(parsed)) throw new Error('the file is not a Lorekeeper notebook');

  if (parsed.format === EXPORT_FORMAT) {
    if (isNumber(parsed.version) && parsed.version > EXPORT_VERSION) {
      throw new Error(`it was exported by a newer version of Lorekeeper (format ${parsed.version})`);
    }
    const name = isString(parsed.name) && parsed.name.trim() ? parsed.name.trim() : fallbackName;
    return { name, notebook: readNotebook(parsed.notebook) };
  }
  // A saved notebook file: { version, data: { folders, pages } }.
  if (isObject(parsed.data)) return { name: fallbackName, notebook: readNotebook(parsed.data) };
  throw new Error('the file is not a Lorekeeper notebook');
}

/**
 * Checks a notebook's shape and repairs what can be repaired: references to
 * missing folders, and folder loops, move things to the top level. Entries
 * that can't be used (no id) are an error rather than silently dropped.
 */
function readNotebook(raw: unknown): Notebook {
  if (!isObject(raw) || !Array.isArray(raw.folders) || !Array.isArray(raw.pages)) {
    throw new Error('the file has no folders and pages');
  }

  const folders: Folder[] = raw.folders.map((f, i) => {
    if (!isObject(f) || !isString(f.id)) throw new Error(`folder ${i + 1} is damaged`);
    const folder: Folder = { id: f.id, name: typeof f.name === 'string' ? f.name : 'Folder', parentId: isString(f.parentId) ? f.parentId : null };
    if (isNumber(f.order)) folder.order = f.order;
    return folder;
  });
  const folderIds = new Set(folders.map((f) => f.id));
  if (folderIds.size !== folders.length) throw new Error('two folders share an id');
  for (const f of folders) if (f.parentId && !folderIds.has(f.parentId)) f.parentId = null;
  breakFolderLoops(folders);

  const pages: Page[] = raw.pages.map((p, i) => {
    if (!isObject(p) || !isString(p.id)) throw new Error(`page ${i + 1} is damaged`);
    const title = typeof p.title === 'string' && p.title.trim() ? p.title : 'Untitled page';
    const folderId = isString(p.folderId) && folderIds.has(p.folderId) ? p.folderId : null;
    const boxes = Array.isArray(p.boxes) ? p.boxes.map((b, j) => readBox(b, `page "${title}", box ${j + 1}`)) : [];
    const info = readInfo(p.info);
    // A stat block from a newer version, or a damaged one, is left out rather than losing the notebook.
    const statBlock = readSharedStatBlock(p.statBlock);
    return { id: p.id, title, folderId, boxes, ...(info ? { info } : {}), ...(statBlock ? { statBlock } : {}) };
  });
  if (new Set(pages.map((p) => p.id)).size !== pages.length) throw new Error('two pages share an id');
  repairPlaces(pages);

  return { folders, pages };
}

/** A page's info, or undefined (a plain note) when it is missing or unrecognised. */
function readInfo(raw: unknown): PageInfo | undefined {
  if (!isObject(raw)) return undefined;
  switch (raw.type) {
    case 'character':
      return { type: 'character', kind: raw.kind === 'pc' ? 'pc' : 'npc' };
    case 'place':
      return { type: 'place', parentPlaceId: isString(raw.parentPlaceId) ? raw.parentPlaceId : null };
    case 'faction':
    case 'item':
      return { type: raw.type };
    default:
      return undefined;
  }
}

/** Places inside a missing page, a non-place, or (through a loop) themselves go to the top of the place tree. */
function repairPlaces(pages: Page[]) {
  const places = new Map<Id, { parentPlaceId: Id | null }>();
  for (const p of pages) if (p.info?.type === 'place') places.set(p.id, p.info);
  for (const info of places.values()) if (info.parentPlaceId && !places.has(info.parentPlaceId)) info.parentPlaceId = null;
  for (const [id, info] of places) {
    const seen = new Set<Id>([id]);
    for (let parent = info.parentPlaceId; parent; parent = places.get(parent)?.parentPlaceId ?? null) {
      if (seen.has(parent)) {
        info.parentPlaceId = null;
        break;
      }
      seen.add(parent);
    }
  }
}

/** A text box, checked. `where` names it in error messages. */
function readBox(raw: unknown, where: string): TextBox {
  if (!isObject(raw) || !isString(raw.id) || !isObject(raw.content) || raw.content.type !== 'doc') {
    throw new Error(`${where} is damaged`);
  }
  return {
    id: raw.id,
    x: isNumber(raw.x) ? Math.max(0, raw.x) : 0,
    y: isNumber(raw.y) ? Math.max(0, raw.y) : 0,
    width: isNumber(raw.width) && raw.width > 0 ? raw.width : 360,
    content: raw.content,
  };
}

/** A folder inside its own sub-folder would vanish from the tree; move such folders to the top level. */
function breakFolderLoops(folders: Folder[]) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  for (const folder of folders) {
    const seen = new Set<Id>();
    let current: Folder | undefined = folder;
    while (current?.parentId) {
      if (seen.has(current.id)) {
        current.parentId = null;
        break;
      }
      seen.add(current.id);
      current = byId.get(current.parentId);
    }
  }
}
