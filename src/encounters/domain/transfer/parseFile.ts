/**
 * @file Parses and fully validates an export file before anything is
 * imported: JSON, app id, schema version, every entity, and that all
 * references resolve within the file for its kind.
 */
import { repeatsSaveLookup } from '../conditionDefaults';
import { fail, InvalidData, readArray, readInt, readObject, readOneOf, readString } from 'campaign-link/formats/read';
import {
  assertUniqueIds,
  readArea,
  readCampaign,
  readCustomCondition,
  readEncounter,
  readTag,
  readTemplate,
} from './readEntities';
import { TRANSFER_APP, TRANSFER_KINDS, TRANSFER_VERSION, type Bundle, type TransferFile, type TransferKind } from './types';

/** Files larger than this (characters) are refused outright. */
const MAX_FILE_CHARS = 50_000_000;

/** The parsed file, or a human-readable reason it can't be imported. */
export type ParseResult = { ok: true; file: TransferFile } | { ok: false; error: string };

/** Validates an export file completely before anything is imported. */
export function parseTransferFile(text: string): ParseResult {
  try {
    if (text.length > MAX_FILE_CHARS) fail('file', 'is too large');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      fail('file', 'is not valid JSON');
    }
    const o = readObject(json, 'file');
    if (o.app !== TRANSFER_APP) fail('file', 'is not an Encounters export');
    const schemaVersion = readInt(o.schemaVersion, 'schemaVersion', 1, Number.MAX_SAFE_INTEGER);
    if (schemaVersion > TRANSFER_VERSION) fail('file', 'was made by a newer version of Encounters; update the app to import it');
    const kind = readOneOf(o.kind, 'kind', TRANSFER_KINDS);
    const data = readBundle(o.data);
    checkReferences(kind, data);
    return { ok: true, file: { app: TRANSFER_APP, schemaVersion, kind, exportedAt: readString(o.exportedAt, 'exportedAt', 64), data } };
  } catch (err) {
    if (err instanceof InvalidData) return { ok: false, error: err.message };
    throw err;
  }
}

/** Reads and validates every collection in the file's data, rejecting duplicate ids. */
function readBundle(v: unknown): Bundle {
  const o = readObject(v, 'data');
  // Custom conditions first: they supply defaults for conditions on combatants.
  const customConditions = readArray(o.customConditions, 'data.customConditions', readCustomCondition);
  const repeats = repeatsSaveLookup(customConditions);
  const bundle: Bundle = {
    campaigns: readArray(o.campaigns, 'data.campaigns', readCampaign),
    areas: readArray(o.areas, 'data.areas', readArea),
    encounters: readArray(o.encounters, 'data.encounters', (x, p) => readEncounter(x, p, repeats)),
    templates: readArray(o.templates, 'data.templates', readTemplate),
    tags: readArray(o.tags, 'data.tags', readTag),
    customConditions,
  };
  for (const key of Object.keys(bundle) as (keyof Bundle)[]) assertUniqueIds(bundle[key], `data.${key}`);
  // Unknown tag ids are harmless; drop them instead of rejecting the file.
  const tagIds = new Set(bundle.tags.map((t) => t.id));
  bundle.templates = bundle.templates.map((t) => ({ ...t, tagIds: t.tagIds.filter((id) => tagIds.has(id)) }));
  return bundle;
}

/** Every reference must resolve inside the file, except a kind's single root item's parent. */
function checkReferences(kind: TransferKind, b: Bundle) {
  // expect(): fails validation with the message unless the condition holds.
  const expect = (cond: boolean, message: string) => cond || fail('data', message);
  const campaignIds = new Set(b.campaigns.map((c) => c.id));
  const areaById = new Map(b.areas.map((a) => [a.id, a]));

  switch (kind) {
    case 'characters':
      expect(b.campaigns.length + b.areas.length + b.encounters.length === 0, 'a character export cannot contain campaigns, areas or encounters');
      break;
    case 'encounter':
      expect(b.encounters.length === 1 && b.campaigns.length + b.areas.length === 0, 'an encounter export must contain exactly one encounter');
      break;
    case 'area': {
      // One top area; everything else nests inside areas in the file.
      const tops = b.areas.filter((a) => a.parentAreaId === null || !areaById.has(a.parentAreaId));
      expect(tops.length === 1 && b.campaigns.length === 0, 'an area export must contain exactly one top-level area');
      expect(b.encounters.every((e) => e.areaId !== null && areaById.has(e.areaId)), 'every encounter must belong to an exported area');
      break;
    }
    case 'campaign':
      expect(b.campaigns.length === 1, 'a campaign export must contain exactly one campaign');
      expect(b.areas.every((a) => campaignIds.has(a.campaignId)), 'an area belongs to a campaign that is not in the file');
      expect(b.encounters.every((e) => e.campaignId !== null && campaignIds.has(e.campaignId)), 'an encounter belongs to a campaign that is not in the file');
      break;
    case 'everything':
      expect(b.areas.every((a) => campaignIds.has(a.campaignId)), 'an area belongs to a campaign that is not in the file');
      expect(b.encounters.every((e) => e.campaignId === null || campaignIds.has(e.campaignId)), 'an encounter belongs to a campaign that is not in the file');
      break;
  }
  if (kind === 'campaign' || kind === 'everything') {
    for (const a of b.areas) {
      if (a.parentAreaId === null) continue;
      const parent = areaById.get(a.parentAreaId);
      expect(!!parent && parent.campaignId === a.campaignId, `area "${a.name}" is inside an area that is not in its campaign`);
    }
    for (const e of b.encounters) {
      if (e.areaId === null) continue;
      const area = areaById.get(e.areaId);
      expect(!!area && area.campaignId === e.campaignId, `encounter "${e.name}" points at an area that is not in its campaign`);
    }
  }
  // Area nesting must not loop back on itself.
  for (const start of b.areas) {
    const seen = new Set<string>();
    for (let a = areaById.get(start.id); a && a.parentAreaId !== null; a = areaById.get(a.parentAreaId)) {
      expect(!seen.has(a.id), `area "${start.name}" is nested inside itself`);
      seen.add(a.id);
    }
  }
  const templateById = new Map(b.templates.map((t) => [t.id, t]));
  for (const e of b.encounters) {
    for (const c of e.combatants) {
      const t = templateById.get(c.templateId);
      expect(!!t, `"${c.name}" in "${e.name}" has no character in the file`);
      expect(t?.formatId === e.formatId, `"${c.name}" in "${e.name}" uses a different format than its encounter`);
    }
  }
}
