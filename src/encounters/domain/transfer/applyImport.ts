/**
 * @file Applies a validated import to the app's data: adds new items,
 * replaces or copies conflicting ones as the user chose, places area and
 * encounter imports where the user picked, and rewrites references so the
 * result is consistent. Pure: returns new data, never touches stores.
 */
import type { CharacterTemplate, Tag } from '../characters';
import type { CustomCondition } from '../conditions';
import { newId, type Id } from '../ids';
import { normalizeAreas } from '../library/tree';
import type { Area, Campaign, Encounter } from '../library/types';
import { copiedItems, itemKey, type ImportPlan, type ItemType, type Resolution } from './plan';
import type { AppData, TransferFile } from './types';

/** Where the user chose to put an imported area or encounter. */
export interface Placement {
  campaignId: Id | null;
  areaId: Id | null;
}

/** Counts reported to the user after an import. */
export interface ImportSummary {
  added: number;
  replaced: number;
  copied: number;
  skipped: number;
}

/** What happens to one imported item. */
type Action = 'add' | 'skip' | 'replace' | 'copy';

/** Case- and whitespace-insensitive name match (for merging tags and conditions). */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Merges an import into the app data. New items are added; identical ones
 * skipped; conflicts follow the user's choice (unchosen = keep mine). Copies
 * get fresh ids and every reference inside the file is rewritten to match.
 * Tags and custom conditions merge by name.
 */
export function applyImport(
  state: AppData,
  file: TransferFile,
  plan: ImportPlan,
  resolutions: Record<string, Resolution>,
  placement: Placement,
): { data: AppData; summary: ImportSummary } {
  const b = file.data;
  const copied = copiedItems(b, plan, resolutions);
  const status = new Map(plan.items.map((i) => [i.key, i.status]));
  const summary: ImportSummary = { added: 0, replaced: 0, copied: 0, skipped: 0 };

  // decide(): the action for one item (copy / add / replace / skip), counted in the summary.
  const decide = (type: ItemType, id: Id): Action => {
    const key = itemKey(type, id);
    const action: Action = copied.has(key)
      ? 'copy'
      : status.get(key) === 'new'
        ? 'add'
        : status.get(key) === 'conflict' && resolutions[key] === 'theirs'
          ? 'replace'
          : 'skip';
    summary[action === 'add' ? 'added' : action === 'copy' ? 'copied' : action === 'replace' ? 'replaced' : 'skipped']++;
    return action;
  };

  // Copies get fresh ids; finalId() maps an id from the file to the id it ends up with.
  const newIds = new Map<string, Id>();
  for (const key of copied) newIds.set(key, newId());
  const finalId = (type: ItemType, id: Id) => newIds.get(itemKey(type, id)) ?? id;
  // Only the item the user explicitly chose to duplicate is renamed.
  const copyName = (type: ItemType, id: Id, name: string) =>
    resolutions[itemKey(type, id)] === 'both' ? `${name} (imported)` : name;

  /** Applies one item's action to a collection. */
  function merge<T extends { id: Id; name: string }>(list: T[], type: ItemType, incoming: T[], prepare: (x: T) => T): T[] {
    let result = [...list];
    for (const raw of incoming) {
      const action = decide(type, raw.id);
      if (action === 'skip') continue;
      const item = { ...prepare(raw), id: finalId(type, raw.id) };
      if (action === 'replace') result = result.map((x) => (x.id === raw.id ? item : x));
      else result.push(action === 'copy' ? { ...item, name: copyName(type, raw.id, raw.name) } : item);
    }
    return result;
  }

  // Tags and custom conditions: same id or same name means "already have it".
  const tagMap = new Map<Id, Id>();
  const tags: Tag[] = [...state.tags];
  for (const t of b.tags) {
    const match = tags.find((x) => x.id === t.id) ?? tags.find((x) => sameName(x.name, t.name));
    if (!match) tags.push(t);
    tagMap.set(t.id, match?.id ?? t.id);
  }
  const conditionMap = new Map<Id, Id>();
  const customConditions: CustomCondition[] = [...state.customConditions];
  for (const c of b.customConditions) {
    const match =
      customConditions.find((x) => x.id === c.id) ??
      customConditions.find((x) => x.formatId === c.formatId && sameName(x.name, c.name));
    if (!match) customConditions.push(c);
    conditionMap.set(c.id, match?.id ?? c.id);
  }

  const templates = merge<CharacterTemplate>(state.templates, 'character', b.templates, (t) => ({
    ...t,
    tagIds: [...new Set(t.tagIds.map((id) => tagMap.get(id) ?? id))],
  }));

  const campaigns = merge<Campaign>(state.campaigns, 'campaign', b.campaigns, (c) => c);

  const bundleCampaignIds = new Set(b.campaigns.map((c) => c.id));
  const bundleAreaIds = new Set(b.areas.map((a) => a.id));
  // A nested area keeps its parent if that came in the file; the top area of an
  // area export goes directly into the chosen campaign. normalizeAreas() then
  // gives nested areas their top area's campaign and breaks any parent loop
  // formed with areas the user kept.
  const areas = normalizeAreas(
    merge<Area>(state.areas, 'area', b.areas, (a) => {
      const campaignId = bundleCampaignIds.has(a.campaignId) ? finalId('campaign', a.campaignId) : placement.campaignId;
      if (!campaignId) throw new Error('An imported area needs a campaign to go into.');
      const parentAreaId = a.parentAreaId && bundleAreaIds.has(a.parentAreaId) ? finalId('area', a.parentAreaId) : null;
      return { ...a, campaignId, parentAreaId };
    }),
  );

  // parentsOf(): an imported encounter's final campaign/area — its imported parent
  // if that came in the same file, the user's placement for a single encounter,
  // otherwise unfiled.
  const parentsOf = (e: Encounter): Placement => {
    if (e.areaId && bundleAreaIds.has(e.areaId)) {
      const areaId = finalId('area', e.areaId);
      return { areaId, campaignId: areas.find((a) => a.id === areaId)?.campaignId ?? null };
    }
    if (e.campaignId && bundleCampaignIds.has(e.campaignId)) return { campaignId: finalId('campaign', e.campaignId), areaId: null };
    if (file.kind === 'encounter') return placement;
    return { campaignId: null, areaId: null };
  };

  const encounters = merge<Encounter>(state.encounters, 'encounter', b.encounters, (e) => ({
    ...e,
    ...parentsOf(e),
    combatants: e.combatants.map((c) => ({
      ...c,
      templateId: finalId('character', c.templateId),
      conditions: c.conditions.map((x) => ({ ...x, conditionId: conditionMap.get(x.conditionId) ?? x.conditionId })),
    })),
  }));

  return { data: { campaigns, areas, encounters, templates, tags, customConditions }, summary };
}
