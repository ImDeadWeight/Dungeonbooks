/**
 * @file The compendium: ready-made creatures from open game content (the 5e
 * SRDs), shipped with the app as one JSON file per format under
 * public/compendium/ (made by scripts/compendium/build.ts). Creatures stay
 * there until used; using one copies it into the character library.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import type { StatBlock } from 'campaign-link/formats/types';

/** One creature. */
export interface CompendiumEntry {
  /** Stable within its file ("adult-silver-dragon"); characters copied from it keep it. */
  id: string;
  name: string;
  /** Challenge rating as the stat block shows it ("1/4", "5"). */
  cr: string;
  /** Creature type, lower case ("dragon", "humanoid"). */
  type: string;
  statBlock: StatBlock;
}

/** A compendium file. */
export interface CompendiumFile {
  format: 'dungeon-books-compendium';
  version: 1;
  formatId: FormatId;
  /** The source's name, shown in the list ("SRD 5.1"). */
  source: string;
  /** The licence notice the source requires, shown with its creatures. */
  attribution: string;
  entries: CompendiumEntry[];
}

/** The formats with a compendium, and their file under public/compendium/. */
export const COMPENDIUM_FILES: Partial<Record<FormatId, string>> = {
  dnd5e: 'srd-5.1.json',
  dnd5e2024: 'srd-5.2.1.json',
};

/** Whether a format has creatures to offer. */
export const hasCompendium = (formatId: FormatId | null): formatId is FormatId => !!formatId && formatId in COMPENDIUM_FILES;
