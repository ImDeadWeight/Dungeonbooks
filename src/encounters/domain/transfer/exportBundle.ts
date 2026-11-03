/**
 * @file Builds export bundles (an item plus everything it references) for
 * characters, encounters, areas, campaigns, or the whole library, and wraps
 * them in the versioned file format.
 */
import type { Id } from '../ids';
import { descendantAreaIds } from '../library/tree';
import type { Area, Campaign, Encounter } from '../library/types';
import { TRANSFER_APP, TRANSFER_VERSION, type AppData, type Bundle, type TransferFile, type TransferKind } from './types';

/**
 * Adds what the chosen items depend on: templates used by combatants (plus
 * any explicitly chosen), their tags, and custom conditions on combatants.
 * Exports are exact copies, including live combat state.
 */
function withDependencies(
  state: AppData,
  items: { campaigns?: Campaign[]; areas?: Area[]; encounters?: Encounter[]; templateIds?: Id[] },
): Bundle {
  const encounters = items.encounters ?? [];
  const templateIds = new Set([...(items.templateIds ?? []), ...encounters.flatMap((e) => e.combatants.map((c) => c.templateId))]);
  const templates = state.templates.filter((t) => templateIds.has(t.id));
  const tagIds = new Set(templates.flatMap((t) => t.tagIds));
  const conditionIds = new Set(encounters.flatMap((e) => e.combatants.flatMap((c) => c.conditions.map((x) => x.conditionId))));
  return {
    campaigns: items.campaigns ?? [],
    areas: items.areas ?? [],
    encounters,
    templates,
    tags: state.tags.filter((t) => tagIds.has(t.id)),
    customConditions: state.customConditions.filter((c) => conditionIds.has(c.id)),
  };
}

/** The chosen characters with their tags. */
export function exportCharacters(state: AppData, templateIds: Id[]): Bundle {
  return withDependencies(state, { templateIds });
}

/** One encounter with its characters, tags and custom conditions. */
export function exportEncounter(state: AppData, encounterId: Id): Bundle {
  return withDependencies(state, { encounters: state.encounters.filter((e) => e.id === encounterId) });
}

/** An area with every area and encounter nested in it, with dependencies. */
export function exportArea(state: AppData, areaId: Id): Bundle {
  const subtree = new Set([areaId, ...descendantAreaIds(state, areaId)]);
  return withDependencies(state, {
    areas: state.areas.filter((a) => subtree.has(a.id)),
    encounters: state.encounters.filter((e) => e.areaId !== null && subtree.has(e.areaId)),
  });
}

/** A campaign with all its areas and encounters, with dependencies. */
export function exportCampaign(state: AppData, campaignId: Id): Bundle {
  return withDependencies(state, {
    campaigns: state.campaigns.filter((c) => c.id === campaignId),
    areas: state.areas.filter((a) => a.campaignId === campaignId),
    encounters: state.encounters.filter((e) => e.campaignId === campaignId),
  });
}

/** Full backup: every template, tag and custom condition, used or not. */
export function exportEverything(state: AppData): Bundle {
  const { campaigns, areas, encounters, templates, tags, customConditions } = state;
  return { campaigns, areas, encounters, templates, tags, customConditions };
}

/** Wraps a bundle in the file envelope (app id, schema version, kind, export time). */
export function toTransferFile(kind: TransferKind, data: Bundle, now = new Date()): TransferFile {
  return { app: TRANSFER_APP, schemaVersion: TRANSFER_VERSION, kind, exportedAt: now.toISOString(), data };
}

/** Windows-safe file name from an item name. */
export function exportFileName(name: string): string {
  const safe = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().slice(0, 80) || 'export';
  return `${safe}.encounters.json`;
}
