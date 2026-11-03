/**
 * @file Validating readers for each entity in an export file (tags,
 * conditions, characters, combatants, encounters, areas, campaigns). Each
 * one turns untrusted JSON into a typed object or fails with the field path.
 */
import type { CharacterTemplate, LoreRef, Tag } from '../characters';
import { MIN_HP } from '../combat/health';
import type { Combatant, CombatantStatus, CombatState, DyingProgress } from '../combat/types';
import { MAX_CONDITION_VALUE, type ActiveCondition, type CustomCondition } from '../conditions';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { FORMATS } from 'campaign-link/formats/registry';
import { LEGACY_FORMAT_ID } from '../library/upgrade';
import type { Area, Campaign, Encounter } from '../library/types';
import {
  fail,
  optional,
  readArray,
  readBool,
  readId,
  readInt,
  readName,
  readNullableId,
  readNullableInt,
  readObject,
  readOneOf,
  readString,
} from 'campaign-link/formats/read';

/** Format ids this version of the app understands. */
const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];
/** Valid combatant statuses. */
const STATUSES: readonly CombatantStatus[] = ['active', 'dying', 'stable', 'dead'];
/** Upper bound for any HP value in a file. */
const MAX_HP = 100000;

/** Default "save each turn" for a condition id, used when an older file lacks the flag. */
type RepeatsSave = (conditionId: string) => boolean;

/** Reads a tag. */
export function readTag(v: unknown, path: string): Tag {
  const o = readObject(v, path);
  return { id: readId(o.id, `${path}.id`), name: readName(o.name, `${path}.name`) };
}

/** Reads a custom condition; rules text and per-turn flag are optional for older files. */
export function readCustomCondition(v: unknown, path: string): CustomCondition {
  const o = readObject(v, path);
  return {
    id: readId(o.id, `${path}.id`),
    name: readName(o.name, `${path}.name`),
    formatId: readOneOf(o.formatId, `${path}.formatId`, FORMAT_IDS),
    // Optional: exports from before conditions carried rules text.
    effect: optional(o, 'effect', path, (x, p) => readString(x, p, 1000), ''),
    endsWhen: optional(o, 'endsWhen', path, (x, p) => readString(x, p, 1000), ''),
    repeatsSave: optional(o, 'repeatsSave', path, readBool, false),
    // Only present for formats with valued conditions; kept absent otherwise so backups stay exact.
    ...(o.valued !== undefined && { valued: readBool(o.valued, `${path}.valued`) }),
    ...(o.dropsEachTurn !== undefined && { dropsEachTurn: readBool(o.dropsEachTurn, `${path}.dropsEachTurn`) }),
  };
}

/** Reads a character; its stat block is validated by its own format. */
export function readTemplate(v: unknown, path: string): CharacterTemplate {
  const o = readObject(v, path);
  const formatId = readOneOf(o.formatId, `${path}.formatId`, FORMAT_IDS);
  return {
    id: readId(o.id, `${path}.id`),
    name: readName(o.name, `${path}.name`),
    kind: readOneOf(o.kind, `${path}.kind`, ['pc', 'npc'] as const),
    formatId,
    tagIds: readArray(o.tagIds, `${path}.tagIds`, readId, 200),
    deathSaves: readBool(o.deathSaves, `${path}.deathSaves`),
    statBlock: o.statBlock === null ? null : FORMATS[formatId].sanitizeStatBlock(o.statBlock, `${path}.statBlock`),
    // Only characters made from a Lorekeeper page have one; kept absent otherwise so backups stay exact.
    ...(o.lore !== undefined && { lore: readLoreRef(o.lore, `${path}.lore`) }),
  };
}

/** Which Lorekeeper page a character came from. */
function readLoreRef(v: unknown, path: string): LoreRef {
  const o = readObject(v, path);
  return { notebookId: readId(o.notebookId, `${path}.notebookId`), pageId: readId(o.pageId, `${path}.pageId`) };
}

/** Older exports lack requiresResolve (defaults from the condition definition) and values (none). */
function readActiveCondition(v: unknown, path: string, repeats: RepeatsSave): ActiveCondition {
  const o = readObject(v, path);
  const conditionId = readId(o.conditionId, `${path}.conditionId`);
  return {
    instanceId: readId(o.instanceId, `${path}.instanceId`),
    conditionId,
    name: readName(o.name, `${path}.name`),
    value: optional(o, 'value', path, (x, p) => readNullableInt(x, p, 1, MAX_CONDITION_VALUE), null),
    dropsEachTurn: optional(o, 'dropsEachTurn', path, readBool, false),
    requiresResolve: optional(o, 'requiresResolve', path, readBool, repeats(conditionId)),
    resolvedThisTurn: readBool(o.resolvedThisTurn, `${path}.resolvedThisTurn`),
  };
}

/** Dying progress; exports from before formats had only 5e death saves (`deathSaves`). */
function readDying(o: Record<string, unknown>, path: string): DyingProgress {
  if (o.dying === undefined) {
    const saves = readObject(o.deathSaves, `${path}.deathSaves`);
    return {
      successes: readInt(saves.successes, `${path}.deathSaves.successes`, 0, 3),
      failures: readInt(saves.failures, `${path}.deathSaves.failures`, 0, 3),
      value: 0,
    };
  }
  const d = readObject(o.dying, `${path}.dying`);
  return {
    successes: readInt(d.successes, `${path}.dying.successes`, 0, 3),
    failures: readInt(d.failures, `${path}.dying.failures`, 0, 3),
    value: readInt(d.value, `${path}.dying.value`, 0, MAX_CONDITION_VALUE),
  };
}

/** Reads a combatant; HP must be both set or both empty, and is clamped to range. */
function readCombatant(v: unknown, path: string, repeats: RepeatsSave): Combatant {
  const o = readObject(v, path);
  const maxHp = readNullableInt(o.maxHp, `${path}.maxHp`, 1, MAX_HP);
  // Negative only in formats with negative-HP dying rules; the engine never goes below MIN_HP.
  const currentHp = readNullableInt(o.currentHp, `${path}.currentHp`, MIN_HP, maxHp ?? MAX_HP);
  if ((maxHp === null) !== (currentHp === null)) fail(path, 'maxHp and currentHp must both be set or both be empty');
  return {
    id: readId(o.id, `${path}.id`),
    templateId: readId(o.templateId, `${path}.templateId`),
    name: readName(o.name, `${path}.name`),
    maxHp,
    currentHp,
    tempHp: readInt(o.tempHp, `${path}.tempHp`, 0, MAX_HP),
    initiative: readNullableInt(o.initiative, `${path}.initiative`, -100, 100),
    addedOrder: readInt(o.addedOrder, `${path}.addedOrder`, 0, 1_000_000),
    tokenDescription: readString(o.tokenDescription, `${path}.tokenDescription`, 300),
    side: optional(o, 'side', path, (x, p) => readString(x, p, 100), ''),
    conditions: readArray(o.conditions, `${path}.conditions`, (x, p) => readActiveCondition(x, p, repeats), 100),
    status: readOneOf(o.status, `${path}.status`, STATUSES),
    dying: readDying(o, path),
    dyingRollMadeThisTurn:
      o.dyingRollMadeThisTurn === undefined
        ? readBool(o.deathSaveMadeThisTurn, `${path}.deathSaveMadeThisTurn`)
        : readBool(o.dyingRollMadeThisTurn, `${path}.dyingRollMadeThisTurn`),
  };
}

/** Reads combat state; whose turn it is must be one of this encounter's combatants. */
function readCombat(v: unknown, path: string, combatants: Combatant[]): CombatState {
  const o = readObject(v, path);
  const currentId = readNullableId(o.currentId, `${path}.currentId`);
  if (currentId !== null && !combatants.some((c) => c.id === currentId)) fail(`${path}.currentId`, 'is not in this encounter');
  return {
    active: readBool(o.active, `${path}.active`),
    round: readInt(o.round, `${path}.round`, 0, 100000),
    currentId,
  };
}

/** Reads an encounter with its combatants and combat state. Files from before encounter formats are 5e. */
export function readEncounter(v: unknown, path: string, repeats: RepeatsSave = () => false): Encounter {
  const o = readObject(v, path);
  const combatants = readArray(o.combatants, `${path}.combatants`, (x, p) => readCombatant(x, p, repeats), 1000);
  assertUniqueIds(combatants, `${path}.combatants`);
  return {
    id: readId(o.id, `${path}.id`),
    name: readName(o.name, `${path}.name`),
    campaignId: readNullableId(o.campaignId, `${path}.campaignId`),
    areaId: readNullableId(o.areaId, `${path}.areaId`),
    formatId: o.formatId === undefined ? LEGACY_FORMAT_ID : readOneOf(o.formatId, `${path}.formatId`, FORMAT_IDS),
    combatants,
    combat: readCombat(o.combat, `${path}.combat`, combatants),
  };
}

/** Reads an area. Files from before nested areas have no parentAreaId: the area sits directly in its campaign. */
export function readArea(v: unknown, path: string): Area {
  const o = readObject(v, path);
  return {
    id: readId(o.id, `${path}.id`),
    name: readName(o.name, `${path}.name`),
    campaignId: readId(o.campaignId, `${path}.campaignId`),
    parentAreaId: o.parentAreaId === undefined ? null : readNullableId(o.parentAreaId, `${path}.parentAreaId`),
  };
}

/** Reads a campaign. Files from before campaign formats have no formatId: no default format. */
export function readCampaign(v: unknown, path: string): Campaign {
  const o = readObject(v, path);
  return {
    id: readId(o.id, `${path}.id`),
    name: readName(o.name, `${path}.name`),
    formatId: o.formatId === undefined || o.formatId === null ? null : readOneOf(o.formatId, `${path}.formatId`, FORMAT_IDS),
  };
}

/** Fails if two items in a list share an id. */
export function assertUniqueIds(items: { id: string }[], path: string) {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) fail(path, `duplicate id ${item.id}`);
    seen.add(item.id);
  }
}
