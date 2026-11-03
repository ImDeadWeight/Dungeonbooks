/**
 * @file Once, before campaigns.json exists: turns Encounters' campaign list,
 * Lorekeeper's notebook list and the links between them into the one
 * campaign list (see unifyPlan.ts). Linked notebooks' notes move to their
 * campaign's id, and so does everything that pointed at the notebook: the
 * sidebar's view and characters made from its pages.
 *
 * Steps run in an order that is safe to stop at any point: notes are copied
 * before anything points at the copy, campaigns.json (which marks this done)
 * is written once nothing else depends on the old lists, and the old files
 * are removed last. Encounters' library keeps its old campaign list until
 * it next saves; the Encounters tab ignores it.
 */
import { CAMPAIGNS_DOC } from '../campaigns/campaignStore';
import { sharedDocuments } from '../bridge/sharedDocuments';
import { ENCOUNTERS_FOLDER } from '../encounters/storage/documents';
import { LOREKEEPER_FOLDER } from '../lorekeeper/storage/documents';
import { createDocuments, type Documents } from '../storage/documents';
import { OLD_LINKS_DOC, type LinkTable } from './oldLinks';
import { planUnify, type SeparateLists } from './unifyPlan';

/** Lorekeeper's notebook list before campaigns (and the notebook saved before there were several). */
const OLD_NOTEBOOK_LIST = 'library';
const LEGACY_NOTEBOOK = 'notebook';
/** Name the legacy single notebook went by. */
const LEGACY_NOTEBOOK_NAME = 'My notebook';
const notebookDoc = (id: string) => `notebook-${id}`;

/** A character as characters.json holds it (only the part changed here). */
interface SavedCharacter {
  lore?: { notebookId: string; pageId: string };
}

/** Makes the one campaign list if it doesn't exist yet. Call before the campaigns and tabs load. */
export async function unifyCampaigns(): Promise<void> {
  if (await sharedDocuments.hasDocument(CAMPAIGNS_DOC)) return;
  const encounters = createDocuments(ENCOUNTERS_FOLDER);
  const lorekeeper = createDocuments(LOREKEEPER_FOLDER);

  const library = await encounters.loadDocument<{ campaigns?: SeparateLists['campaigns'] }>('library', () => ({}));
  const notebookList = await lorekeeper.loadDocument<{ notebooks: SeparateLists['notebooks']; activeId: string | null }>(
    OLD_NOTEBOOK_LIST,
    () => ({ notebooks: [], activeId: null }),
  );
  const links = await sharedDocuments.loadDocument<{ notebookByCampaign: LinkTable }>(OLD_LINKS_DOC, () => ({ notebookByCampaign: {} }));

  let { notebooks, activeId: activeNotebookId } = notebookList.data;
  // A notebook saved before Lorekeeper had several becomes a notebook of its own.
  if (notebooks.length === 0 && (await lorekeeper.hasDocument(LEGACY_NOTEBOOK))) {
    const id = crypto.randomUUID();
    await copyDocument(lorekeeper, LEGACY_NOTEBOOK, notebookDoc(id));
    notebooks = [{ id, name: LEGACY_NOTEBOOK_NAME }];
    activeNotebookId = id;
  }

  const plan = planUnify({
    campaigns: library.data.campaigns ?? [],
    notebooks,
    activeNotebookId,
    links: links.data.notebookByCampaign,
  });
  const moves = Object.entries(plan.notebookMoves);

  for (const [from, to] of moves) await copyDocument(lorekeeper, notebookDoc(from), notebookDoc(to));
  if (moves.length > 0) {
    await moveViews(lorekeeper, plan.notebookMoves);
    await moveCharacterPages(encounters, plan.notebookMoves);
  }

  await sharedDocuments.saveDocument(CAMPAIGNS_DOC, { campaigns: plan.campaigns, activeId: plan.activeId });

  for (const [from] of moves) await lorekeeper.removeDocument(notebookDoc(from));
  await lorekeeper.removeDocument(OLD_NOTEBOOK_LIST);
  await sharedDocuments.removeDocument(OLD_LINKS_DOC);
}

/** Copies a document's file as it is (a missing one is skipped). */
async function copyDocument(docs: Documents, from: string, to: string) {
  const loaded = await docs.loadDocument<unknown>(from, () => null);
  if (loaded.data !== null) await docs.saveDocument(to, loaded.data);
}

/** The sidebar's folded folders, kept per notebook, move with the notes. */
async function moveViews(docs: Documents, moves: Record<string, string>) {
  const views = await docs.loadDocument<Record<string, unknown>>('view', () => ({}));
  const moved = Object.fromEntries(Object.entries(views.data).map(([id, view]) => [moves[id] ?? id, view]));
  await docs.saveDocument('view', moved);
}

/** Characters made from a moved notebook's pages point at the campaign's id. */
async function moveCharacterPages(docs: Documents, moves: Record<string, string>) {
  if (!(await docs.hasDocument('characters'))) return;
  const characters = await docs.loadDocument<{ templates: SavedCharacter[] }>('characters', () => ({ templates: [] }));
  const templates = characters.data.templates.map((t) =>
    t.lore && moves[t.lore.notebookId] ? { ...t, lore: { ...t.lore, notebookId: moves[t.lore.notebookId] } } : t,
  );
  await docs.saveDocument('characters', { ...characters.data, templates });
}
