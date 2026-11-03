/**
 * @file Re-pointing characters at an imported copy of their notebook.
 * Importing a notebook gives it a new id but keeps its pages' ids, so a
 * character made from one of its pages points at a notebook that isn't here
 * any more. When that page turns up in a notebook that is here, the
 * character follows it.
 */
import type { LorekeeperCatalog } from 'campaign-link';
import type { CharacterTemplate, LoreRef } from './characters';
import type { Id } from './ids';

/**
 * The characters whose notebook is missing (not in `notebookIds`) but whose
 * page is in one of `catalogs`, each with its new reference.
 */
export function repairedLoreRefs(
  templates: Pick<CharacterTemplate, 'id' | 'lore'>[],
  notebookIds: Set<Id>,
  catalogs: LorekeeperCatalog[],
): Map<Id, LoreRef> {
  const notebookOfPage = new Map<Id, Id>();
  for (const catalog of catalogs) for (const page of catalog.pages) notebookOfPage.set(page.id, catalog.notebookId);

  const repaired = new Map<Id, LoreRef>();
  for (const t of templates) {
    if (!t.lore || notebookIds.has(t.lore.notebookId)) continue;
    const notebookId = notebookOfPage.get(t.lore.pageId);
    if (notebookId) repaired.set(t.id, { notebookId, pageId: t.lore.pageId });
  }
  return repaired;
}
