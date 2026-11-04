/**
 * @file The record of a change an AI made to the notes, and undoing it. A
 * change keeps only the pages and folders it touched, as they were before
 * and after, so undoing it puts those back and leaves the user's other
 * edits alone. Store updates never mutate pages, so a page whose object
 * changed is a page the call touched.
 */
import type { Id } from '../../lorekeeper/domain/ids';
import type { Folder, Notebook, Page } from '../../lorekeeper/domain/notebook';

/** Most changes kept per campaign; older ones drop off. */
export const AI_CHANGES_LIMIT = 100;

/** Who made a change: the Assistant tab's model, or an AI app over MCP. */
export type AiChangeSource = 'assistant' | 'app';

/** One AI change, undoable. */
export interface AiChange {
  id: string;
  /** When it was made (ms since 1970). */
  at: number;
  source: AiChangeSource;
  /** What it did, in words ("Add text to "Mira Thorne""). */
  label: string;
  /** Pages it changed, as they were before. */
  before: Page[];
  /** The same pages and the pages it made, as it left them (to tell whether the user changed them since). */
  after: Page[];
  /** Pages it made, which undoing removes. */
  createdPageIds: Id[];
  /** Folders it made, which undoing removes when nothing is left in them. */
  createdFolderIds: Id[];
  /** Set once undone. */
  undoneAt?: number;
}

type Contents = Pick<Notebook, 'folders' | 'pages'>;

/** What a call changed between two states of the notes, or null when it changed nothing. */
export function captureChange(
  before: Contents,
  after: Contents,
  meta: Pick<AiChange, 'id' | 'at' | 'source' | 'label'>,
): AiChange | null {
  const beforeById = new Map(before.pages.map((p) => [p.id, p]));
  const changed = after.pages.filter((p) => beforeById.get(p.id) !== p);
  const folderIds = new Set(before.folders.map((f) => f.id));
  const createdFolderIds = after.folders.filter((f) => !folderIds.has(f.id)).map((f) => f.id);
  if (!changed.length && !createdFolderIds.length) return null;
  return {
    ...meta,
    before: changed.flatMap((p) => beforeById.get(p.id) ?? []),
    after: changed,
    createdPageIds: changed.filter((p) => !beforeById.has(p.id)).map((p) => p.id),
    createdFolderIds,
  };
}

/** Pages the change touched that are no longer as it left them (the user, or a later change, edited them). */
export function changedSince(current: Contents, change: AiChange): Page[] {
  const now = new Map(current.pages.map((p) => [p.id, p]));
  return change.after.filter((p) => {
    const page = now.get(p.id);
    return page !== undefined && JSON.stringify(page) !== JSON.stringify(p);
  });
}

/** True when the folder holds nothing (no folders, no pages). */
const isEmptyFolder = (folders: Folder[], pages: Page[], id: Id) =>
  !folders.some((f) => f.parentId === id) && !pages.some((p) => p.folderId === id);

/**
 * The notes with a change undone: pages it made are removed (pages since put
 * under them move to the top level), pages it changed go back to how they
 * were (also if deleted since), and folders it made go if empty. Restored
 * boxes get fresh ids from `newId`, so open editors show their old text.
 */
export function undoChange(current: Contents, change: AiChange, newId: () => Id): Contents {
  const created = new Set(change.createdPageIds);
  const restored = new Map(change.before.map((p) => [p.id, { ...p, boxes: p.boxes.map((b) => ({ ...b, id: newId() })) }]));

  let pages = current.pages
    .filter((p) => !created.has(p.id))
    .map((p) => restored.get(p.id) ?? p)
    .map((p) => (p.parentPageId && created.has(p.parentPageId) ? { ...p, parentPageId: undefined, folderId: null } : p));
  const present = new Set(pages.map((p) => p.id));
  pages = [...pages, ...[...restored.values()].filter((p) => !present.has(p.id))];

  let folders = current.folders;
  // Innermost first, so a made folder holding only another made folder goes too.
  for (const id of [...change.createdFolderIds].reverse()) {
    if (isEmptyFolder(folders, pages, id)) folders = folders.filter((f) => f.id !== id);
  }
  return { folders, pages };
}

/** Adds a change to the list, newest last, keeping at most AI_CHANGES_LIMIT. */
export function addChange(changes: AiChange[], change: AiChange): AiChange[] {
  return [...changes, change].slice(-AI_CHANGES_LIMIT);
}
