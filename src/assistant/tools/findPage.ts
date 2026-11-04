/**
 * @file Finding the page a tool argument names (by title, alias or id),
 * suggesting close names when none fits.
 */
import { searchablePages, searchPages } from '../../lorekeeper/domain/pageSearch';
import type { Page } from '../../lorekeeper/domain/notebook';
import { useNotebook } from '../../lorekeeper/state/notebookStore';
import { linkNames } from '../notesMarkdown';
import { ToolError } from './types';

/** The page an argument names, or an error that suggests close names. */
export function findPage(name: unknown): Page {
  if (typeof name !== 'string' || !name.trim()) throw new ToolError('Name the page by its title (or an alias, or its id).');
  const { pages } = useNotebook.getState();
  const id = linkNames().pageNamed(name.trim());
  const page = id && pages.find((p) => p.id === id);
  if (page) return page;
  const close = searchPages(name, searchablePages(pages), { currentPageId: '', folderId: null, recentPageIds: [] }, 5);
  throw new ToolError(`No page is called "${name}".${close.length ? ` Close names: ${close.map((r) => `"${r.name}"`).join(', ')}.` : ''}`);
}
