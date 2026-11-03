/**
 * @file Turning the separate campaign and notebook lists into one campaign
 * list. A campaign linked to a notebook becomes one campaign (the campaign's
 * id and name; the notebook's notes move to that id). A campaign without a
 * notebook starts with empty notes; a notebook without a campaign becomes a
 * campaign of its own (keeping its id) with no encounters yet.
 */
import { uniqueName, type Campaign } from '../campaigns/types';
import type { LinkTable } from './oldLinks';

/** What the app held before campaigns were one list. */
export interface SeparateLists {
  /** Encounters' campaigns (saves from before campaign formats have none). */
  campaigns: (Omit<Campaign, 'formatId'> & { formatId?: Campaign['formatId'] })[];
  /** Lorekeeper's notebooks. */
  notebooks: { id: string; name: string }[];
  /** The notebook that was open. */
  activeNotebookId: string | null;
  /** Campaign → notebook links. */
  links: LinkTable;
}

/** The one list, and where linked notebooks' notes move. */
export interface UnifyPlan {
  campaigns: Campaign[];
  /** The campaign to open: the one the open notebook became (null: the app picks). */
  activeId: string | null;
  /** Notebook id → the campaign id its notes now belong to (linked notebooks only). */
  notebookMoves: Record<string, string>;
}

export function planUnify(old: SeparateLists): UnifyPlan {
  const campaignIds = new Set(old.campaigns.map((c) => c.id));
  const notebookIds = new Set(old.notebooks.map((n) => n.id));
  const notebookMoves: Record<string, string> = {};
  for (const [campaignId, notebookId] of Object.entries(old.links)) {
    if (campaignIds.has(campaignId) && notebookIds.has(notebookId) && !(notebookId in notebookMoves)) {
      notebookMoves[notebookId] = campaignId;
    }
  }

  const campaigns: Campaign[] = old.campaigns.map((c) => ({ id: c.id, name: c.name, formatId: c.formatId ?? null }));
  for (const n of old.notebooks) {
    if (n.id in notebookMoves) continue;
    campaigns.push({ id: n.id, name: uniqueName(campaigns.map((c) => c.name), n.name), formatId: null });
  }

  const open = old.activeNotebookId;
  const activeId = open && notebookIds.has(open) ? notebookMoves[open] ?? open : null;
  return { campaigns, activeId, notebookMoves };
}
