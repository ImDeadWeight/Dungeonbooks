/**
 * @file Campaigns: what both tabs are about. Each campaign has its encounters
 * (Encounters tab) and its notes (Lorekeeper tab), both keyed by its id.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';

/** One campaign. */
export interface Campaign {
  id: string;
  name: string;
  /** Default format for this campaign's new encounters and their new characters; null = none. */
  formatId: FormatId | null;
}

/** Every campaign, and the one that is open. */
export interface CampaignList {
  campaigns: Campaign[];
  activeId: string | null;
}

/** Name of the campaign made on a first start with nothing to bring over. */
export const FIRST_CAMPAIGN_NAME = 'My campaign';
/** Name given to campaigns made with New campaign. */
export const NEW_CAMPAIGN_NAME = 'New campaign';

/** A list with no campaigns yet. */
export function emptyCampaignList(): CampaignList {
  return { campaigns: [], activeId: null };
}

/** `wanted`, or `wanted (2)`, `wanted (3)`… whichever no campaign is using yet (ignoring case). */
export function uniqueName(taken: string[], wanted: string): string {
  const used = new Set(taken.map((n) => n.trim().toLowerCase()));
  let name = wanted;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${wanted} (${i})`;
  return name;
}

/** Sorts names the way the campaign list shows them (case-insensitive, numbers in order). */
export function byName(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}
