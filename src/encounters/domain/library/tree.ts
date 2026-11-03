/**
 * @file Campaign/area/encounter tree operations: queries for the sidebar,
 * moves (drag and drop, Edit dialog), cascading deletes, and checking which
 * encounters use a character. Areas can nest inside other areas.
 */
import type { Id } from '../ids';
import type { Area, Encounter, EncounterLibrary, Library } from './types';

/**
 * Top-level areas of a campaign. An area whose parent is missing (e.g. bad
 * data) is shown here too rather than disappearing.
 */
export function areasOf(lib: Pick<Library, 'areas'>, campaignId: Id): Area[] {
  return lib.areas.filter(
    (a) => a.campaignId === campaignId && (a.parentAreaId === null || !lib.areas.some((p) => p.id === a.parentAreaId)),
  );
}

/** Areas directly inside another area. */
export function childAreasOf(lib: Pick<Library, 'areas'>, areaId: Id): Area[] {
  return lib.areas.filter((a) => a.parentAreaId === areaId);
}

/** Every area nested anywhere below an area (not including itself). */
export function descendantAreaIds(lib: Pick<Library, 'areas'>, areaId: Id): Set<Id> {
  const found = new Set<Id>();
  const queue = [areaId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const a of lib.areas) {
      if (a.parentAreaId === current && !found.has(a.id) && a.id !== areaId) {
        found.add(a.id);
        queue.push(a.id);
      }
    }
  }
  return found;
}

/** An area and everything nested below it. */
function subtreeOf(lib: Pick<Library, 'areas'>, areaId: Id): Set<Id> {
  return new Set([areaId, ...descendantAreaIds(lib, areaId)]);
}

/** A campaign's areas in sidebar order (parents before children), with nesting depth and a "Prison › Mines" path label. */
export function flattenAreas(lib: Pick<Library, 'areas'>, campaignId: Id): { area: Area; depth: number; path: string }[] {
  const out: { area: Area; depth: number; path: string }[] = [];
  const visit = (area: Area, depth: number, prefix: string) => {
    const path = prefix ? `${prefix} › ${area.name}` : area.name;
    out.push({ area, depth, path });
    for (const child of childAreasOf(lib, area.id)) visit(child, depth + 1, path);
  };
  for (const top of areasOf(lib, campaignId)) visit(top, 0, '');
  return out;
}

/**
 * Repairs area parents after an import: breaks any parent loop, and gives
 * every nested area the campaign of the area at the top of its chain.
 */
export function normalizeAreas(areas: Area[]): Area[] {
  const byId = new Map(areas.map((a) => [a.id, a]));
  // Break loops: walk up from each area; if we revisit one, detach the area that closed the loop.
  for (const start of areas) {
    const seen = new Set<Id>();
    let current: Area | undefined = byId.get(start.id);
    while (current && current.parentAreaId !== null) {
      seen.add(current.id);
      const parent = byId.get(current.parentAreaId);
      if (parent && seen.has(parent.id)) {
        byId.set(current.id, { ...current, parentAreaId: null });
        break;
      }
      current = parent;
    }
  }
  // rootOf(): the topmost area of a chain (loops are already broken).
  const rootOf = (a: Area): Area => {
    let current = a;
    for (let parent = current.parentAreaId ? byId.get(current.parentAreaId) : undefined; parent; ) {
      current = parent;
      parent = current.parentAreaId ? byId.get(current.parentAreaId) : undefined;
    }
    return current;
  };
  return areas.map((a) => {
    const fixed = byId.get(a.id)!;
    const campaignId = rootOf(fixed).campaignId;
    return fixed.campaignId === campaignId && fixed === a ? a : { ...fixed, campaignId };
  });
}

/** Encounters sitting directly under a campaign (not inside an area). */
export function looseEncountersOf(lib: EncounterLibrary, campaignId: Id): Encounter[] {
  return lib.encounters.filter((e) => e.campaignId === campaignId && e.areaId === null);
}

/** Encounters inside an area. */
export function encountersOfArea(lib: EncounterLibrary, areaId: Id): Encounter[] {
  return lib.encounters.filter((e) => e.areaId === areaId);
}

/** What the sidebar shows while searching. */
export interface TreeFilter {
  /** Areas and encounters to show: matches, the areas above them, and everything inside a matching area. */
  visible: Set<Id>;
  /** Areas opened because a match is inside them. */
  opened: Set<Id>;
}

/**
 * Narrows a campaign's tree to a search: areas and encounters whose names
 * contain the text (ignoring case), the areas above them, and everything
 * inside a matching area. Null when the search is blank.
 */
export function filterCampaign(lib: EncounterLibrary, campaignId: Id, query: string): TreeFilter | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const areas = lib.areas.filter((a) => a.campaignId === campaignId);
  const areaIds = new Set(areas.map((a) => a.id));
  // The area each area sits in; null for top-level areas (and one whose parent is missing; see areasOf).
  const parentOf = new Map<Id, Id | null>(areas.map((a) => [a.id, a.parentAreaId && areaIds.has(a.parentAreaId) ? a.parentAreaId : null]));
  const matchingNodes = new Set(areas.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id));
  // The areas above an item, nearest first (bounded in case of a parent loop).
  const above = (parentId: Id | null) => {
    const chain: Id[] = [];
    for (let id = parentId; id !== null && parentOf.has(id) && chain.length < parentOf.size; id = parentOf.get(id)!) chain.push(id);
    return chain;
  };
  const visible = new Set<Id>();
  const opened = new Set<Id>();
  const consider = (id: Id, parentId: Id | null, name: string) => {
    const chain = above(parentId);
    if (name.toLowerCase().includes(q)) {
      visible.add(id);
      for (const n of chain) {
        visible.add(n);
        opened.add(n);
      }
    } else if (chain.some((n) => matchingNodes.has(n))) {
      visible.add(id);
    }
  };
  for (const a of areas) consider(a.id, parentOf.get(a.id) ?? null, a.name);
  for (const e of lib.encounters) {
    if (e.campaignId === campaignId) consider(e.id, e.areaId && areaIds.has(e.areaId) ? e.areaId : null, e.name);
  }
  return { visible, opened };
}

/** Drop target for an encounter. An area target implies its campaign. */
export type EncounterDestination =
  | { kind: 'campaign'; campaignId: Id }
  | { kind: 'area'; areaId: Id };

/** Moves an encounter into a campaign, or an area (taking on the area's campaign). */
export function moveEncounter<L extends EncounterLibrary>(lib: L, encounterId: Id, dest: EncounterDestination): L {
  let campaignId: Id;
  let areaId: Id | null = null;
  if (dest.kind === 'campaign') campaignId = dest.campaignId;
  else {
    const area = lib.areas.find((a) => a.id === dest.areaId);
    if (!area) return lib;
    campaignId = area.campaignId;
    areaId = area.id;
  }
  return {
    ...lib,
    encounters: lib.encounters.map((e) => (e.id === encounterId ? { ...e, campaignId, areaId } : e)),
  };
}

/** Drop target for an area: directly in a campaign, or inside another area. */
export type AreaDestination =
  | { kind: 'campaign'; campaignId: Id }
  | { kind: 'area'; areaId: Id };

/** True if the area can go to the destination (not into itself or anything nested in it). */
export function canMoveArea(lib: Library, areaId: Id, dest: AreaDestination): boolean {
  if (!lib.areas.some((a) => a.id === areaId)) return false;
  if (dest.kind === 'campaign') return lib.campaigns.some((c) => c.id === dest.campaignId);
  return lib.areas.some((a) => a.id === dest.areaId) && !subtreeOf(lib, areaId).has(dest.areaId);
}

/**
 * Moves an area into a campaign or another area. Everything nested in it
 * (areas and encounters) moves along and takes on the new campaign.
 */
export function moveArea(lib: Library, areaId: Id, dest: AreaDestination): Library {
  if (!canMoveArea(lib, areaId, dest)) return lib;
  const parent = dest.kind === 'area' ? lib.areas.find((a) => a.id === dest.areaId)! : null;
  const campaignId = dest.kind === 'campaign' ? dest.campaignId : parent!.campaignId;
  const subtree = subtreeOf(lib, areaId);
  return {
    ...lib,
    areas: lib.areas.map((a) => {
      if (a.id === areaId) return { ...a, campaignId, parentAreaId: parent?.id ?? null };
      return subtree.has(a.id) ? { ...a, campaignId } : a;
    }),
    encounters: lib.encounters.map((e) => (e.areaId && subtree.has(e.areaId) ? { ...e, campaignId } : e)),
  };
}

/** A deleted campaign's areas and encounters go with it. */
export function deleteCampaignContents<L extends EncounterLibrary>(lib: L, campaignId: Id): L {
  return {
    ...lib,
    areas: lib.areas.filter((a) => a.campaignId !== campaignId),
    encounters: lib.encounters.filter((e) => e.campaignId !== campaignId),
  };
}

/**
 * Areas and encounters whose campaign isn't in the list (unfiled encounters
 * from before every encounter had a campaign, or ones a deleted campaign left
 * behind) move into `campaignId`, so nothing is out of sight.
 */
export function adoptOrphans<L extends EncounterLibrary>(lib: L, campaignIds: Set<Id>, campaignId: Id): L {
  const orphanAreas = new Set(lib.areas.filter((a) => !campaignIds.has(a.campaignId)).map((a) => a.id));
  // Unfiled encounters in old saves have a null campaign, which isn't in the list either.
  const orphan = (e: Encounter) => !campaignIds.has(e.campaignId);
  if (orphanAreas.size === 0 && !lib.encounters.some(orphan)) return lib;
  return {
    ...lib,
    areas: lib.areas.map((a) => (orphanAreas.has(a.id) ? { ...a, campaignId } : a)),
    encounters: lib.encounters.map((e) =>
      orphan(e) ? { ...e, campaignId, areaId: e.areaId && orphanAreas.has(e.areaId) ? e.areaId : null } : e,
    ),
  };
}

/** Deleting an area deletes everything nested in it: areas and encounters. */
export function deleteArea<L extends EncounterLibrary>(lib: L, areaId: Id): L {
  const subtree = subtreeOf(lib, areaId);
  return {
    ...lib,
    areas: lib.areas.filter((a) => !subtree.has(a.id)),
    encounters: lib.encounters.filter((e) => !(e.areaId && subtree.has(e.areaId))),
  };
}

/** Number of areas and encounters nested anywhere inside an area (for delete confirmations). */
export function areaContents(lib: EncounterLibrary, areaId: Id): { areas: number; encounters: number } {
  const subtree = subtreeOf(lib, areaId);
  return {
    areas: subtree.size - 1,
    encounters: lib.encounters.filter((e) => e.areaId && subtree.has(e.areaId)).length,
  };
}

/** Deletes one encounter. */
export function deleteEncounter<L extends EncounterLibrary>(lib: L, encounterId: Id): L {
  return { ...lib, encounters: lib.encounters.filter((e) => e.id !== encounterId) };
}

/** Encounters that still reference a template; such templates can't be deleted. */
export function encountersUsingTemplate(lib: EncounterLibrary, templateId: Id): Encounter[] {
  return lib.encounters.filter((e) => e.combatants.some((c) => c.templateId === templateId));
}
