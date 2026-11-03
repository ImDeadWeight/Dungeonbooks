/**
 * @file The campaign list and which campaign is open, saved to the shared
 * campaigns.json. Plain list edits only: lifecycle.ts creates, opens and
 * deletes campaigns together with each tab's data.
 */
import { create } from 'zustand';
import { sharedDocuments } from '../bridge/sharedDocuments';
import { reportError } from './errors';
import { byName, emptyCampaignList, FIRST_CAMPAIGN_NAME, type Campaign, type CampaignList } from './types';

/** The campaigns' document. */
export const CAMPAIGNS_DOC = 'campaigns';

/** Campaign list plus its edits. */
interface CampaignState extends CampaignList {
  add(campaign: Campaign): void;
  /** Changes a campaign's name or default format. */
  update(id: string, changes: Partial<Omit<Campaign, 'id'>>): void;
  remove(id: string): void;
  setActive(id: string | null): void;
}

export const useCampaigns = create<CampaignState>((set) => ({
  ...emptyCampaignList(),
  add: (campaign) => set((s) => ({ campaigns: [...s.campaigns, campaign] })),
  update: (id, changes) => set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...changes } : c)) })),
  remove: (id) => set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) })),
  setActive: (id) => set({ activeId: id }),
}));

/** The open campaign, or undefined when there is none. */
export function useActiveCampaign(): Campaign | undefined {
  return useCampaigns((s) => s.campaigns.find((c) => c.id === s.activeId));
}

/** The open campaign's id, from outside React (set once startCampaigns has run). */
export function activeCampaignId(): string {
  return useCampaigns.getState().activeId!;
}

/**
 * Loads the list, then saves it whenever it changes. A campaign is always
 * open: the first start gets one, and a missing open campaign is replaced by
 * the first in the list. Resolves to a warning if the file was unreadable.
 */
export async function startCampaigns(): Promise<string | undefined> {
  const loaded = await sharedDocuments.loadDocument<CampaignList>(CAMPAIGNS_DOC, emptyCampaignList);
  let { campaigns, activeId } = loaded.data;
  if (campaigns.length === 0) campaigns = [{ id: crypto.randomUUID(), name: FIRST_CAMPAIGN_NAME, formatId: null }];
  if (!campaigns.some((c) => c.id === activeId)) activeId = [...campaigns].sort((a, b) => byName(a.name, b.name))[0].id;
  useCampaigns.setState({ campaigns, activeId });
  if (campaigns !== loaded.data.campaigns || activeId !== loaded.data.activeId) {
    await sharedDocuments.saveDocument(CAMPAIGNS_DOC, { campaigns, activeId });
  }
  useCampaigns.subscribe(({ campaigns, activeId }, before) => {
    if (campaigns === before.campaigns && activeId === before.activeId) return;
    sharedDocuments.saveDocument(CAMPAIGNS_DOC, { campaigns, activeId }).catch((err) => reportError('Could not save the campaign list', err));
  });
  return loaded.warning;
}
