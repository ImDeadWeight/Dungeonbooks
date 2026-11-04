/**
 * @file What the Encounters tab needs from Lorekeeper: each campaign's
 * characters, places, factions and items (with characters' stat blocks),
 * published as catalogues (see bridge/). Also reads the open campaign's
 * encounters catalogue from there.
 */
import { makeLorekeeperCatalog, type EncountersCatalog, type LorekeeperCatalog, type LorePage } from 'campaign-link';
import { sameCatalogs, useCatalogs } from '../../bridge/catalogs';
import { useCampaigns } from '../../campaigns/campaignStore';
import type { Id } from '../domain/ids';
import type { Page } from '../domain/notebook';
import { useNotebook } from './notebookStore';
import { readNotebook } from './persistence';

/** Wait this long after a change before publishing it, so typing publishes once per pause. */
const PUBLISH_DELAY_MS = 300;

/** A page as published to Encounters: only typed pages (characters, places, factions, items), and characters' stat blocks. */
function toLorePage(p: Page): LorePage | null {
  if (!p.info) return null;
  if (p.info.type !== 'character') return { id: p.id, title: p.title, info: p.info };
  // Encounters doesn't use where characters belong.
  const info = { type: p.info.type, kind: p.info.kind };
  return { id: p.id, title: p.title, info, ...(p.statBlock ? { statBlock: p.statBlock } : {}) };
}
const lorePages = (pages: Page[]) => pages.map(toLorePage).filter((p): p is LorePage => p !== null);

/**
 * Catalogues of campaigns' notes. The open campaign's is built from memory;
 * the others only change while open, so the last one built (or one read from
 * the notes' file) stays right until they're opened again.
 */
const latest: Record<Id, LorekeeperCatalog> = {};
/** Campaigns whose notes file is being read for a catalogue. */
const reading = new Set<Id>();

/** Publishes every campaign's catalogue. */
function publish() {
  const { campaigns, activeId } = useCampaigns.getState();
  const fresh: Record<Id, LorekeeperCatalog> = {};
  for (const { id, name } of campaigns) {
    if (id === activeId) {
      latest[id] = makeLorekeeperCatalog(id, name, lorePages(useNotebook.getState().pages));
    } else if (!latest[id]) {
      readCatalog(id, name);
      continue;
    }
    // A rename shows without waiting for the notes to be opened.
    fresh[id] = { ...latest[id], name };
  }
  useCatalogs.setState((s) => ({ lore: sameCatalogs(s.lore, fresh) }));
}

/** Builds a closed campaign's catalogue from its notes file, then publishes again. */
function readCatalog(id: Id, name: string) {
  if (reading.has(id)) return;
  reading.add(id);
  readNotebook(id)
    .then((notebook) => {
      latest[id] = makeLorekeeperCatalog(id, name, lorePages(notebook.pages));
      publish();
    })
    .catch(() => undefined)
    .finally(() => reading.delete(id));
}

/** Publishes now, then shortly after every change Encounters should see. */
export function startCampaignLink() {
  publish();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(publish, PUBLISH_DELAY_MS);
  };
  // Campaign names, which campaign is open, and the open notes' pages.
  useCampaigns.subscribe((s, before) => {
    // The campaign left behind was saved before the switch; its file has edits the last publish may have missed.
    if (s.activeId !== before.activeId && before.activeId) delete latest[before.activeId];
    if (s.campaigns !== before.campaigns || s.activeId !== before.activeId) soon();
  });
  useNotebook.subscribe((s, before) => {
    if (s.pages !== before.pages) soon();
  });
}

/** The catalogue of the open campaign's encounters, or null until Encounters has published it. */
export function useOpenNotebookCatalog(): EncountersCatalog | null {
  const activeId = useCampaigns((s) => s.activeId);
  return useCatalogs((s) => (activeId ? s.encounters[activeId] ?? null : null));
}
