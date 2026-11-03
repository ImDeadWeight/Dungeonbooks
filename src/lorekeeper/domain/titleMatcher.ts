/**
 * @file Finds mentions of page titles in plain text, for link suggestions.
 * Matching ignores case and extra whitespace, needs whole words, and prefers
 * the longest title when titles overlap ("Thalamar Imperium" beats "Thalamar").
 */
import type { Id } from './ids';

/** A page that text can link to. */
export interface LinkCandidate {
  pageId: Id;
  title: string;
}

/** A title found in the text: [from, to) are character offsets. */
export interface TitleMatch {
  from: number;
  to: number;
  pageId: Id;
}

/** Titles shorter than this are never suggested (a page called "A" would match everywhere). */
const MIN_TITLE_LENGTH = 2;

/** Lower-cased with runs of whitespace collapsed, so "The  Veilstrand" and "the veilstrand" are the same key. */
export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Escapes regex metacharacters, and lets any whitespace in a title match any run of whitespace. */
function titlePattern(title: string): string {
  return title
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
}

/** Finds title mentions in text; build once per set of candidates, then call `find` per text run. */
export interface TitleMatcher {
  find(text: string): TitleMatch[];
}

/**
 * Builds a matcher for the given pages. When two pages share a title the
 * first one listed wins.
 */
export function createTitleMatcher(candidates: LinkCandidate[]): TitleMatcher {
  const byKey = new Map<string, Id>();
  for (const c of candidates) {
    const key = normalizeTitle(c.title);
    if (key.length >= MIN_TITLE_LENGTH && !byKey.has(key)) byKey.set(key, c.pageId);
  }
  if (byKey.size === 0) return { find: () => [] };

  // Longest first, so at any position the regex tries the longest title before its prefixes.
  const keys = [...byKey.keys()].sort((a, b) => b.length - a.length);
  // Whole words only: no letter or digit directly before or after the title.
  const source = `(?<![\\p{L}\\p{N}])(?:${keys.map(titlePattern).join('|')})(?![\\p{L}\\p{N}])`;
  const regex = new RegExp(source, 'giu');

  return {
    find(text) {
      const matches: TitleMatch[] = [];
      for (const m of text.matchAll(regex)) {
        const pageId = byKey.get(normalizeTitle(m[0]));
        if (pageId) matches.push({ from: m.index!, to: m.index! + m[0].length, pageId });
      }
      return matches;
    },
  };
}
