/**
 * @file Which Lorekeeper notebook each Encounters campaign is linked to: at
 * most one notebook per campaign and one campaign per notebook. Both tabs
 * read and change it; it's saved in the shared links.json.
 *
 * The separate apps needed link claims that the other app confirmed through
 * the shared folder. Here both sides are in one app, so a link is just a pair.
 */
import { create } from 'zustand';
import { sharedDocuments } from './sharedDocuments';

/** The links' document. */
const LINKS_DOC = 'links';

/** Campaign id → notebook id. */
export type LinkTable = Record<string, string>;

interface LinksState {
  notebookByCampaign: LinkTable;
}

export const useLinks = create<LinksState>(() => ({ notebookByCampaign: {} }));

/** Links a campaign to a notebook, or unlinks it (null). Any other link the notebook had ends. */
export function linkCampaign(campaignId: string, notebookId: string | null) {
  useLinks.setState(({ notebookByCampaign }) => {
    const others = Object.entries(notebookByCampaign).filter(([c, n]) => c !== campaignId && n !== notebookId);
    return { notebookByCampaign: Object.fromEntries(notebookId ? [...others, [campaignId, notebookId]] : others) };
  });
}

/** Ends a notebook's link, if it has one. */
export function unlinkNotebook(notebookId: string) {
  const campaignId = campaignOf(useLinks.getState().notebookByCampaign, notebookId);
  if (campaignId) linkCampaign(campaignId, null);
}

/** The campaign a notebook is linked to, or null. */
export function campaignOf(links: LinkTable, notebookId: string | null): string | null {
  if (!notebookId) return null;
  return Object.keys(links).find((c) => links[c] === notebookId) ?? null;
}

/** Ends the links of campaigns (or notebooks) that no longer exist. */
export function dropLinksWithout(side: 'campaign' | 'notebook', existing: Set<string>) {
  const links = useLinks.getState().notebookByCampaign;
  const kept = Object.entries(links).filter(([c, n]) => existing.has(side === 'campaign' ? c : n));
  if (kept.length !== Object.keys(links).length) useLinks.setState({ notebookByCampaign: Object.fromEntries(kept) });
}

/** Saves a whole set of links before they're loaded (used when copying the old apps' links). */
export function writeLinks(notebookByCampaign: LinkTable): Promise<void> {
  return sharedDocuments.saveDocument(LINKS_DOC, { notebookByCampaign });
}

/** Loads the links, then saves them whenever they change. Resolves to a warning if the file was unreadable. */
export async function startLinks(): Promise<string | undefined> {
  const loaded = await sharedDocuments.loadDocument<LinksState>(LINKS_DOC, () => ({ notebookByCampaign: {} }));
  useLinks.setState(loaded.data);
  useLinks.subscribe((s) => {
    sharedDocuments.saveDocument(LINKS_DOC, { notebookByCampaign: s.notebookByCampaign }).catch(() => undefined);
  });
  return loaded.warning;
}
