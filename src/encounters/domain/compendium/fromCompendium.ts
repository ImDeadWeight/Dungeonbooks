/**
 * @file Using a compendium creature: encounters hold characters from the
 * library, so a creature is copied in the first time (tagged "SRD") and that
 * copy is reused after. Also the compendium list's search.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import type { CharacterTemplate } from '../characters';
import type { Id } from '../ids';
import type { CompendiumEntry } from './types';

/** The tag compendium copies get, so they can be found (and filtered out) in the library. */
export const COMPENDIUM_TAG = 'SRD';

/** The library's copy of a creature (edited or not), if there is one. */
export function findCopy(templates: CharacterTemplate[], formatId: FormatId, entryId: string): CharacterTemplate | undefined {
  return templates.find((t) => t.formatId === formatId && t.compendiumId === entryId);
}

/** A new library character for a creature (an NPC; at 0 HP it dies, as monsters do). */
export function templateFromEntry(entry: CompendiumEntry, formatId: FormatId, tagId: Id, id: Id): CharacterTemplate {
  return { id, name: entry.name, kind: 'npc', formatId, tagIds: [tagId], deathSaves: false, statBlock: entry.statBlock, compendiumId: entry.id };
}

/** What the compendium list shows: name contains the query, CR within range, of the type. */
export interface CompendiumFilter {
  query: string;
  /** Lowest and highest CR shown, as numbers (1/4 is 0.25); null for no limit. */
  minCr: number | null;
  maxCr: number | null;
  /** Creature type, or '' for all. */
  type: string;
}

export const EMPTY_COMPENDIUM_FILTER: CompendiumFilter = { query: '', minCr: null, maxCr: null, type: '' };

/** "1/4" → 0.25, "5" → 5. */
export function crValue(cr: string): number {
  const [top, bottom] = cr.split('/').map(Number);
  return bottom ? top / bottom : top;
}

/** The entries the filter lets through, in the file's (name) order. */
export function filterEntries(entries: CompendiumEntry[], f: CompendiumFilter): CompendiumEntry[] {
  const q = f.query.trim().toLowerCase();
  return entries.filter((e) => {
    const cr = crValue(e.cr);
    return (
      (!q || e.name.toLowerCase().includes(q)) &&
      (f.minCr === null || cr >= f.minCr) &&
      (f.maxCr === null || cr <= f.maxCr) &&
      (!f.type || e.type === f.type)
    );
  });
}

/** Every creature type in the entries, sorted. */
export function entryTypes(entries: CompendiumEntry[]): string[] {
  return [...new Set(entries.map((e) => e.type))].sort();
}
