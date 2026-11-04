/**
 * @file Notes as Markdown: a page, or a folder's pages, as one piece of text
 * (the copy buttons, for pasting into any AI chat), and the link lookups
 * Markdown needs. Uses the open campaign's notes.
 */
import { byFolderOrder, byName, PAGE_TYPES, pageType, parentPlace, type Page } from '../lorekeeper/domain/notebook';
import { normalizeTitle } from '../lorekeeper/domain/titleMatcher';
import type { Id } from '../lorekeeper/domain/ids';
import { useNotebook } from '../lorekeeper/state/notebookStore';
import { toMarkdown, type LinkNames } from './markdown';

/** Links in Markdown, resolved against the notebook's titles, then aliases (any case), or ids. */
export function linkNames(): LinkNames {
  const { pages } = useNotebook.getState();
  return {
    titleOf: (id) => pages.find((p) => p.id === id)?.title,
    pageNamed: (name) => {
      const key = normalizeTitle(name);
      return (
        pages.find((p) => p.id === name || normalizeTitle(p.title) === key) ?? pages.find((p) => (p.aliases ?? []).some((a) => normalizeTitle(a) === key))
      )?.id;
    },
  };
}

/** How a page's kind reads: "Character (NPC)", "Place inside Aurelane". */
export function describeType(page: Page, pages: Page[]): string {
  const label = PAGE_TYPES.find((t) => t.type === pageType(page))!.label;
  if (page.info?.type === 'character') return `${label} (${page.info.kind === 'pc' ? 'player character' : 'NPC'})`;
  const parent = parentPlace(pages, page);
  return parent ? `${label} inside ${parent.title}` : label;
}

/** A page as Markdown: its title as a heading, what it is, then its text boxes in reading order. */
export function pageAsMarkdown(page: Page, headingLevel = 1): string {
  const { pages } = useNotebook.getState();
  const names = linkNames();
  const about = [describeType(page, pages), ...(page.aliases?.length ? [`also called ${page.aliases.join(', ')}`] : [])].join(' · ');
  const boxes = [...page.boxes].sort((a, b) => a.y - b.y || a.x - b.x).map((b) => toMarkdown(b.content, names)).filter((t) => t.trim());
  return [`${'#'.repeat(headingLevel)} ${page.title}`, `*${about}*`, ...boxes].join('\n\n');
}

/**
 * Every page in a folder and the folders inside it as one Markdown text: a
 * heading per folder ("Places / Cities"), its pages under it, pages split by rules.
 */
export function folderAsMarkdown(folderId: Id): string {
  const { folders, pages } = useNotebook.getState();
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return '';
  const parts: string[] = [];
  const walk = (id: Id, path: string) => {
    const inside = pages.filter((p) => p.folderId === id).sort((a, b) => byName(a.title, b.title));
    if (inside.length) parts.push(`# ${path}`, ...inside.map((page) => pageAsMarkdown(page, 2)));
    for (const child of folders.filter((f) => f.parentId === id).sort(byFolderOrder)) walk(child.id, `${path} / ${child.name}`);
  };
  walk(folderId, folder.name);
  return parts.join('\n\n---\n\n');
}
