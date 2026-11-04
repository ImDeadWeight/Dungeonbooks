/**
 * @file Creating, opening, renaming and deleting campaigns. A campaign's data
 * lives in both tabs (its encounters, its notes), so each tab registers what
 * it does when a campaign is opened or deleted, and these run them all. A
 * new campaign needs nothing set up: a tab with no data for it starts empty.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import { useCampaigns } from './campaignStore';
import { reportError } from './errors';
import { byName, NEW_CAMPAIGN_NAME, uniqueName, type Campaign, type PartySize } from './types';

/** What a tab does with its data when campaigns change. */
export interface CampaignParticipant {
  /** About to show this campaign: load what's needed. Throwing keeps the current campaign open. */
  opening?(id: string): Promise<void> | void;
  /** The campaign is gone: delete its data. */
  deleted?(id: string): Promise<void> | void;
}

const participants: CampaignParticipant[] = [];

/** Adds a tab's part in opening and deleting campaigns. */
export function registerParticipant(participant: CampaignParticipant) {
  participants.push(participant);
}

const takenNames = () => useCampaigns.getState().campaigns.map((c) => c.name);

/** Opens a campaign in both tabs. Resolves false (and says why) if it couldn't be opened; the current one stays open. */
export async function switchCampaign(id: string): Promise<boolean> {
  if (id === useCampaigns.getState().activeId) return true;
  try {
    for (const p of participants) await p.opening?.(id);
  } catch (err) {
    reportError('Could not open that campaign', err);
    return false;
  }
  useCampaigns.getState().setActive(id);
  return true;
}

/**
 * Adds a campaign (its name made unique) and opens it. `id` is given when its
 * data was written first (an imported notebook). Resolves to its id.
 */
export async function createCampaign(input: { name: string; formatId?: FormatId | null; id?: string }): Promise<string> {
  const id = input.id ?? crypto.randomUUID();
  useCampaigns.getState().add({ id, name: uniqueName(takenNames(), input.name.trim() || NEW_CAMPAIGN_NAME), formatId: input.formatId ?? null });
  await switchCampaign(id);
  return id;
}

/** Adds campaigns that came in an import, and takes the imported name and format of ones already here. */
export function mergeImportedCampaigns(imported: Campaign[]) {
  const store = useCampaigns.getState();
  for (const c of imported) {
    const mine = store.campaigns.find((x) => x.id === c.id);
    if (!mine) store.add(c);
    else if (mine.name !== c.name || mine.formatId !== c.formatId) store.update(c.id, { name: c.name, formatId: c.formatId });
  }
}

/** Renames a campaign; blank names are ignored. */
export function renameCampaign(id: string, name: string) {
  if (name.trim()) useCampaigns.getState().update(id, { name: name.trim() });
}

/** Sets a campaign's default format for new encounters and characters. */
export function setCampaignFormat(id: string, formatId: FormatId | null) {
  useCampaigns.getState().update(id, { formatId });
}

/** Sets (or, with null, clears) the campaign's usual party. */
export function setCampaignParty(id: string, party: PartySize | null) {
  useCampaigns.setState((s) => ({
    campaigns: s.campaigns.map((c) => {
      if (c.id !== id) return c;
      const { party: _old, ...rest } = c;
      return party ? { ...rest, party } : rest;
    }),
  }));
}

/**
 * Deletes a campaign with its encounters and notes. The open one is swapped
 * for another first (a new one if it was the last), so a campaign is always open.
 */
export async function deleteCampaign(id: string): Promise<void> {
  const { campaigns, activeId } = useCampaigns.getState();
  if (id === activeId) {
    const other = campaigns.filter((c) => c.id !== id).sort((a, b) => byName(a.name, b.name))[0];
    if (other) {
      if (!(await switchCampaign(other.id))) return;
    } else {
      await createCampaign({ name: NEW_CAMPAIGN_NAME });
    }
  }
  useCampaigns.getState().remove(id);
  try {
    for (const p of participants) await p.deleted?.(id);
  } catch (err) {
    reportError('The campaign was removed, but some of its data could not be deleted', err);
  }
}
