/**
 * @file Brings notebooks saved by older versions up to the current format.
 *
 * Format 2 added child pages and characters belonging to places and
 * factions. Before that, a place with pages of its own had to be a folder
 * holding a page of the same name ("Vaultrock" folder › "Vaultrock" page),
 * and characters were sorted into folders named after where they belong.
 * Upgrading turns each such pair into one page holding the rest, and lets a
 * character in a folder named after a place or faction belong to it.
 */
import type { Id } from './ids';
import { isGroup, NOTEBOOK_FORMAT, type Folder, type Notebook, type Page } from './notebook';

/** Names compared the way the sidebar shows them: ignoring case and outer spaces. */
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The notebook in the current format; the same object when it already is. */
export function upgradeNotebook(notebook: Notebook): Notebook {
  if ((notebook.format ?? 1) >= NOTEBOOK_FORMAT) return notebook;
  const pages = mergeFolderPages(notebook.folders, fillBelongsTo(notebook.folders, notebook.pages));
  const merged = new Set(pages.merged.keys());
  return { format: NOTEBOOK_FORMAT, folders: notebook.folders.filter((f) => !merged.has(f.id)), pages: pages.pages };
}

/** Characters in a folder named after exactly one place or faction now belong to it. */
function fillBelongsTo(folders: Folder[], pages: Page[]): Page[] {
  const folderName = new Map(folders.map((f) => [f.id, f.name]));
  return pages.map((p) => {
    if (p.info?.type !== 'character' || p.info.belongsTo?.length || !p.folderId) return p;
    const name = folderName.get(p.folderId);
    const groups = name === undefined ? [] : pages.filter((g) => isGroup(g) && same(g.title, name));
    return groups.length === 1 ? { ...p, info: { ...p.info, belongsTo: [groups[0].id] } } : p;
  });
}

/**
 * Each folder with no sub-folders that holds exactly one page of its own name
 * is replaced by that page, with the folder's other pages under it.
 * `merged` maps each replaced folder to its page.
 */
function mergeFolderPages(folders: Folder[], pages: Page[]): { pages: Page[]; merged: Map<Id, Id> } {
  const hasSubfolders = new Set(folders.map((f) => f.parentId));
  const merged = new Map<Id, Id>();
  for (const folder of folders) {
    if (hasSubfolders.has(folder.id)) continue;
    const named = pages.filter((p) => p.folderId === folder.id && same(p.title, folder.name));
    if (named.length === 1) merged.set(folder.id, named[0].id);
  }
  const parentOf = new Map(folders.map((f) => [f.id, f.parentId]));
  return {
    merged,
    pages: pages.map((p) => {
      const pageOfFolder = p.folderId ? merged.get(p.folderId) : undefined;
      if (!pageOfFolder) return p;
      // The named page takes the folder's place; the others go under it.
      if (pageOfFolder === p.id) return { ...p, folderId: parentOf.get(p.folderId!) ?? null };
      return { ...p, folderId: null, parentPageId: pageOfFolder };
    }),
  };
}
