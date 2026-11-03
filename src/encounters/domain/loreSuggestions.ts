/**
 * @file Which Lorekeeper Character pages to suggest while naming a character:
 * titles that start with what's typed come first, then titles with a word
 * that starts with it (typing "dray" finds "Cassian Dray").
 */
import type { CharacterKind, LoreRef } from './characters';

/** A Character page from a linked Lorekeeper notebook. */
export interface LoreCharacter extends LoreRef {
  title: string;
  kind: CharacterKind;
  notebookName: string;
}

/** Most suggestions shown at once. */
export const MAX_SUGGESTIONS = 8;

/** The pages to suggest for what's typed, best first. */
export function suggestLoreCharacters(characters: LoreCharacter[], typed: string): LoreCharacter[] {
  const q = typed.trim().toLowerCase();
  if (!q) return [];
  const starts = (c: LoreCharacter) => c.title.toLowerCase().startsWith(q);
  const wordStarts = (c: LoreCharacter) => c.title.toLowerCase().split(/[\s'-]+/).some((w) => w.startsWith(q));
  return characters
    .filter((c) => starts(c) || wordStarts(c))
    .sort((a, b) => Number(starts(b)) - Number(starts(a)) || a.title.localeCompare(b.title))
    .slice(0, MAX_SUGGESTIONS);
}
