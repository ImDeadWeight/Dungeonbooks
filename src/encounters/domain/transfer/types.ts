/**
 * @file Export/import file format: the versioned envelope, the kinds of
 * export, and the bundle of entities a file carries.
 */
import type { CharacterTemplate, Tag } from '../characters';
import type { CustomCondition } from '../conditions';
import type { Area, Campaign, Encounter, Library } from '../library/types';

/** Marks a JSON file as an Encounters export. */
export const TRANSFER_APP = 'encounters';
/**
 * Current file format version; files from newer versions are refused.
 * 2: encounters carry a format; combatants have format-neutral dying progress
 * and conditions can carry a value. Version 1 files still import.
 */
export const TRANSFER_VERSION = 2;
/** File name suffix used for exports. */
export const TRANSFER_EXTENSION = 'encounters.json';

/** What an export file contains. */
export const TRANSFER_KINDS = ['characters', 'encounter', 'area', 'campaign', 'everything'] as const;
/** One of the export kinds; decides placement rules and which references must resolve. */
export type TransferKind = (typeof TRANSFER_KINDS)[number];

/** Everything an export carries: the item(s) plus every dependency they reference. */
export interface Bundle {
  campaigns: Campaign[];
  areas: Area[];
  encounters: Encounter[];
  templates: CharacterTemplate[];
  tags: Tag[];
  customConditions: CustomCondition[];
}

/** The JSON written to an .encounters.json file. */
export interface TransferFile {
  app: typeof TRANSFER_APP;
  schemaVersion: number;
  kind: TransferKind;
  /** ISO timestamp, shown in the import preview. */
  exportedAt: string;
  data: Bundle;
}

/** The whole app's saved data, as export reads it and import produces it. */
export interface AppData extends Library {
  templates: CharacterTemplate[];
  tags: Tag[];
  customConditions: CustomCondition[];
}

/** A bundle with nothing in it. */
export function emptyBundle(): Bundle {
  return { campaigns: [], areas: [], encounters: [], templates: [], tags: [], customConditions: [] };
}
