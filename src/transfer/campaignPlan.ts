/**
 * @file Planning a campaign file's import. The encounters half is planned as
 * an Encounters campaign import (item by item, with conflicts); the notes
 * half goes with the campaign: a campaign already here whose notes differ
 * counts as a conflict, and the choice made for the campaign decides its
 * notes too (keep mine, use the file's, or a copy with the file's notes).
 */
import { itemKey, planImport, sameContent, type ImportPlan, type ItemStatus, type Resolution } from '../encounters/domain/transfer/plan';
import type { AppData } from '../encounters/domain/transfer/types';
import type { Notebook } from '../lorekeeper/domain/notebook';
import type { CampaignFile } from './campaignFile';

/** What happens to the file's notes. */
export type NotesAction = 'add' | 'replace' | 'copy' | 'skip';

/** How many of the file's pages are new here, the same, or different (matched by id). */
export interface PageCounts {
  new: number;
  identical: number;
  conflict: number;
}

const isEmpty = (notes: Notebook | null) => !notes || (notes.pages.length === 0 && notes.folders.length === 0);

/** The file's notes against this campaign's notes here (null: the campaign isn't here). Empty notes take anything. */
export function notesStatus(here: Notebook | null, incoming: Notebook): ItemStatus {
  if (isEmpty(here)) return 'new';
  return sameContent({ folders: here!.folders, pages: here!.pages }, { folders: incoming.folders, pages: incoming.pages }) ? 'identical' : 'conflict';
}

/** The file's pages against the pages here, for the import's summary. */
export function pageCounts(here: Notebook | null, incoming: Notebook): PageCounts {
  const mine = new Map((here?.pages ?? []).map((p) => [p.id, p]));
  const counts: PageCounts = { new: 0, identical: 0, conflict: 0 };
  for (const page of incoming.pages) {
    const match = mine.get(page.id);
    counts[!match ? 'new' : sameContent(match, page) ? 'identical' : 'conflict']++;
  }
  return counts;
}

/** The Encounters plan for the file, with its campaign a conflict when only its notes differ. */
export function planCampaignImport(file: CampaignFile, state: AppData, notes: ItemStatus): ImportPlan {
  const plan = planImport(file.encounters, state);
  if (notes !== 'conflict') return plan;
  const key = itemKey('campaign', file.campaign.id);
  return { ...plan, items: plan.items.map((i) => (i.key === key && i.status === 'identical' ? { ...i, status: 'conflict' } : i)) };
}

/** What happens to the file's notes, given the plan, the user's choices and how the notes compare. */
export function notesAction(file: CampaignFile, plan: ImportPlan, resolutions: Record<string, Resolution>, notes: ItemStatus): NotesAction {
  const key = itemKey('campaign', file.campaign.id);
  const campaign = plan.items.find((i) => i.key === key);
  if (!campaign || campaign.status === 'new') return 'add';
  const choice = resolutions[key] ?? 'mine';
  if (campaign.status === 'conflict' && choice === 'both') return 'copy';
  if (notes === 'new') return 'add';
  if (notes === 'conflict' && choice === 'theirs') return 'replace';
  return 'skip';
}
