/**
 * @file Import planning: compares each imported item with the app's data by
 * id (new, identical, or conflicting), works out which items become copies
 * under "Keep both", and lists the conflicts still needing a decision.
 */
import type { Id } from '../ids';
import type { AppData, Bundle, TransferFile } from './types';

/** Kinds of importable item that can conflict. Tags and conditions merge by name instead. */
export type ItemType = 'campaign' | 'area' | 'encounter' | 'character';
/** new = not in the app; identical = already there unchanged; conflict = same id, different content. */
export type ItemStatus = 'new' | 'identical' | 'conflict';
/** The user's choice for a conflict: keep mine, use the imported one, or keep both (import as a copy). */
export type Resolution = 'mine' | 'theirs' | 'both';

/** One importable item and how it compares with the app's data. */
export interface PlanItem {
  key: string;
  type: ItemType;
  id: Id;
  name: string;
  status: ItemStatus;
}

/** Everything the import preview shows. */
export interface ImportPlan {
  items: PlanItem[];
  /** area exports need a campaign to go into; encounter exports may be placed anywhere. */
  placement: 'campaign-required' | 'optional' | 'none';
}

/** Unique key for an item across types, e.g. "character:abc". Resolutions are keyed by it. */
export const itemKey = (type: ItemType, id: Id) => `${type}:${id}`;

/** Deep equality independent of key order. */
export function sameContent(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

/** JSON with object keys sorted, so equal content always produces equal text. */
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${stableStringify(x)}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/** Compares one imported item with existing items of the same type. */
function statusOf<T extends { id: Id }>(item: T, existing: T[]): ItemStatus {
  const mine = existing.find((x) => x.id === item.id);
  if (!mine) return 'new';
  return sameContent(mine, item) ? 'identical' : 'conflict';
}

/** Classifies every importable item against what the app already has (matched by id). */
export function planImport(file: TransferFile, state: AppData): ImportPlan {
  const b = file.data;
  const items: PlanItem[] = [
    ...b.campaigns.map((x) => ({ type: 'campaign' as const, x, status: statusOf(x, state.campaigns) })),
    ...b.areas.map((x) => ({ type: 'area' as const, x, status: statusOf(x, state.areas) })),
    ...b.encounters.map((x) => ({ type: 'encounter' as const, x, status: statusOf(x, state.encounters) })),
    ...b.templates.map((x) => ({ type: 'character' as const, x, status: statusOf(x, state.templates) })),
  ].map(({ type, x, status }) => ({ key: itemKey(type, x.id), type, id: x.id, name: x.name, status }));

  const placement = file.kind === 'area' ? 'campaign-required' : file.kind === 'encounter' ? 'optional' : 'none';
  return { items, placement };
}

/**
 * Items that become copies with new ids: those resolved "both", plus the
 * contents of any campaign or area that is copied (so the copy isn't empty).
 */
export function copiedItems(bundle: Bundle, plan: ImportPlan, resolutions: Record<string, Resolution>): Set<string> {
  const copied = new Set(
    plan.items.filter((i) => i.status === 'conflict' && resolutions[i.key] === 'both').map((i) => i.key),
  );
  // Repeat until stable: an area is copied with its campaign or its parent area, at any depth.
  for (let changed = true; changed; ) {
    changed = false;
    for (const a of bundle.areas) {
      const key = itemKey('area', a.id);
      if (copied.has(key)) continue;
      const parentCopied = a.parentAreaId !== null && copied.has(itemKey('area', a.parentAreaId));
      if (parentCopied || copied.has(itemKey('campaign', a.campaignId))) {
        copied.add(key);
        changed = true;
      }
    }
  }
  for (const e of bundle.encounters) {
    const parentCopied = e.areaId
      ? copied.has(itemKey('area', e.areaId))
      : e.campaignId !== null && copied.has(itemKey('campaign', e.campaignId));
    if (parentCopied) copied.add(itemKey('encounter', e.id));
  }
  return copied;
}

/** Conflicts the user still has to decide; ones inside a copied container are moot. */
export function openConflicts(bundle: Bundle, plan: ImportPlan, resolutions: Record<string, Resolution>): PlanItem[] {
  const copied = copiedItems(bundle, plan, resolutions);
  return plan.items.filter((i) => i.status === 'conflict' && !(copied.has(i.key) && resolutions[i.key] !== 'both'));
}
