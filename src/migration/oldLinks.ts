/**
 * @file The links the separate apps had made, from each app's saved claims
 * (campaign-link.json): a campaign and a notebook were linked when each
 * claimed the other.
 */
import type { LinkTable } from '../bridge/links';

/** A saved claim, as campaign-link.json holds it (only the part needed here). */
interface OldClaim {
  partnerId?: unknown;
}

/** Each app's claims: Encounters' by campaign id, Lorekeeper's by notebook id. */
export type OldClaims = Record<string, OldClaim | null | undefined>;

/** Campaign → notebook for every pair whose claims name each other. */
export function linksFromClaims(campaignClaims: OldClaims, notebookClaims: OldClaims): LinkTable {
  const links: LinkTable = {};
  for (const [campaignId, claim] of Object.entries(campaignClaims)) {
    const notebookId = claim?.partnerId;
    if (typeof notebookId !== 'string') continue;
    if (notebookClaims[notebookId]?.partnerId === campaignId) links[campaignId] = notebookId;
  }
  return links;
}
