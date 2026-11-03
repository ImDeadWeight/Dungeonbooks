/**
 * @file Lorekeeper's side of the link with Encounters: publishes the
 * notebook list and, for each linked notebook, its characters, places,
 * factions and items (with characters' stat blocks), for the Encounters tab
 * (see bridge/). Reads the linked campaigns' catalogues from there too.
 */
import { makeLorekeeperCatalog, type EncountersCatalog, type LorekeeperCatalog, type LorePage } from 'campaign-link';
import { sameCatalogs, sameNames, useCatalogs } from '../../bridge/catalogs';
import { campaignOf, dropLinksWithout, useLinks } from '../../bridge/links';
import type { Id } from '../domain/ids';
import type { Page } from '../domain/notebook';
import { useLibrary } from './libraryStore';
import { useNotebook } from './notebookStore';
import { readNotebook } from './persistence';

export { linkCampaign, unlinkNotebook } from '../../bridge/links';

/** Wait this long after a change before publishing it, so typing publishes once per pause. */
const PUBLISH_DELAY_MS = 300;

/** A page as published to Encounters: only typed pages (characters, places, factions, items), and characters' stat blocks. */
function toLorePage(p: Page): LorePage | null {
  if (!p.info) return null;
  const statBlock = p.info.type === 'character' ? p.statBlock : undefined;
  return { id: p.id, title: p.title, info: p.info, ...(statBlock ? { statBlock } : {}) };
}
const lorePages = (pages: Page[]) => pages.map(toLorePage).filter((p): p is LorePage => p !== null);

/**
 * Catalogues of notebooks that aren't open. The open notebook's is built from
 * memory; the others only change while open, so the last one built (or one
 * read from the notebook's file) stays right until it's opened again.
 */
const latest: Record<Id, LorekeeperCatalog> = {};
/** Notebooks whose file is being read for a catalogue. */
const reading = new Set<Id>();

/** Publishes the notebook list and every linked notebook's catalogue. */
function publish() {
  const { notebooks, activeId } = useLibrary.getState();
  // A deleted notebook's link ends with it.
  dropLinksWithout('notebook', new Set(notebooks.map((n) => n.id)));
  const nameOf = (id: Id) => notebooks.find((n) => n.id === id)?.name;
  const fresh: Record<Id, LorekeeperCatalog> = {};
  for (const notebookId of Object.values(useLinks.getState().notebookByCampaign)) {
    const name = nameOf(notebookId);
    if (name === undefined) continue;
    if (notebookId === activeId) {
      latest[notebookId] = makeLorekeeperCatalog(notebookId, name, lorePages(useNotebook.getState().pages));
    } else if (!latest[notebookId]) {
      readCatalog(notebookId, name);
      continue;
    }
    // A rename shows without waiting for the notebook to be opened.
    fresh[notebookId] = { ...latest[notebookId], name };
  }
  useCatalogs.setState((s) => ({
    notebooks: sameNames(s.notebooks, notebooks.map((n) => ({ id: n.id, name: n.name }))),
    lore: sameCatalogs(s.lore, fresh),
  }));
}

/** Builds a closed notebook's catalogue from its file, then publishes again. */
function readCatalog(notebookId: Id, name: string) {
  if (reading.has(notebookId)) return;
  reading.add(notebookId);
  readNotebook(notebookId)
    .then((notebook) => {
      latest[notebookId] = makeLorekeeperCatalog(notebookId, name, lorePages(notebook.pages));
      publish();
    })
    .catch(() => undefined)
    .finally(() => reading.delete(notebookId));
}

/** Publishes now, then shortly after every change Encounters should see. */
export function startCampaignLink() {
  publish();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(publish, PUBLISH_DELAY_MS);
  };
  // Notebook names, the open notebook's pages, and which notebooks are linked.
  useLibrary.subscribe((s, before) => {
    // The notebook left behind was saved before the switch; its file has edits the last publish may have missed.
    if (s.activeId !== before.activeId && before.activeId) delete latest[before.activeId];
    if (s.notebooks !== before.notebooks || s.activeId !== before.activeId) soon();
  });
  useNotebook.subscribe((s, before) => {
    if (s.pages !== before.pages) soon();
  });
  useLinks.subscribe(soon);
}

/** The Encounters campaign a notebook is linked to, or null. */
export function useLinkedCampaignId(notebookId: Id | null): Id | null {
  return useLinks((s) => campaignOf(s.notebookByCampaign, notebookId));
}

/** The catalogue of the Encounters campaign linked to the open notebook, or null. */
export function useOpenNotebookCatalog(): EncountersCatalog | null {
  const campaignId = useLinkedCampaignId(useLibrary((s) => s.activeId));
  return useCatalogs((s) => (campaignId ? s.encounters[campaignId] ?? null : null));
}

/** Whether the open notebook is linked to an Encounters campaign. */
export function useOpenNotebookLinkStatus(): 'linked' | 'unlinked' {
  return useLinkedCampaignId(useLibrary((s) => s.activeId)) ? 'linked' : 'unlinked';
}
