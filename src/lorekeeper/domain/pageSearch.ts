/**
 * @file Finding pages from partly typed names, for link autocomplete. Two
 * questions: which pages fit a search (the link picker's list, forgiving of
 * typos and matching any word of a title or alias), and how the word being
 * typed would finish (the grey completion, strict, shown only when one page
 * is the clear answer).
 */
import type { Id } from './ids';
import { pageParentId, pageType, type Page, type PageType } from './notebook';

/** What the search knows about one page. */
export interface SearchablePage {
  pageId: Id;
  title: string;
  /** Other names the page goes by. */
  aliases: string[];
  type: PageType;
  folderId: Id | null;
}

/** Where the search happens, for ranking: nearby and recently opened pages come first among equal matches. */
export interface SearchContext {
  /** The page being edited; never offered. */
  currentPageId: Id;
  /** Its folder. */
  folderId: Id | null;
  /** Pages opened lately, most recent first. */
  recentPageIds: Id[];
}

/** A page that fits a search. */
export interface PageResult {
  pageId: Id;
  /** The name that matched: the title, or the alias when only an alias did. */
  name: string;
  /** True when `name` is an alias. */
  viaAlias: boolean;
  type: PageType;
}

/** How the words before the caret could finish as a mention of a page. */
export interface Completion {
  pageId: Id;
  /** Offset in the searched text where the mention starts (it may span several words). */
  from: number;
  /** The rest of the word being typed, cased as in the page's name. */
  rest: string;
}

/** The searchable view of the notebook's pages. */
export function searchablePages(pages: Page[]): SearchablePage[] {
  return pages.map((p) => ({ pageId: p.id, title: p.title, aliases: p.aliases ?? [], type: pageType(p), folderId: pageParentId(p) }));
}

/** A word and where it starts. Apostrophes inside a word ("Ka'rn") keep it whole. */
interface Word {
  text: string;
  lower: string;
  index: number;
}

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

function words(text: string): Word[] {
  return [...text.matchAll(WORD)].map((m) => ({ text: m[0], lower: m[0].toLowerCase(), index: m.index! }));
}

/** Words so common that finishing them as a page name would only get in the way. */
const COMMON_WORDS = new Set(['the', 'and', 'of', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by']);

/** Letters a typed word needs before a completion is offered, and letters the completion must add. */
const MIN_TYPED = 3;
const MIN_REST = 2;
/** Words before the caret a mention can span. */
const MAX_MENTION_WORDS = 4;
/** Results the picker lists. */
export const MAX_RESULTS = 8;

/**
 * Fewest edits (insert, delete, change, or swap two neighbours) that turn
 * `query` into some prefix of `word`, so a word still being typed can match.
 */
export function prefixDistance(query: string, word: string): number {
  const q = query.length;
  const w = word.length;
  // rows[i][j]: edits from query[0..i) to word[0..j).
  const rows: number[][] = Array.from({ length: q + 1 }, (_, i) => Array.from({ length: w + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= q; i++) {
    for (let j = 1; j <= w; j++) {
      const cost = query[i - 1] === word[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && query[i - 1] === word[j - 2] && query[i - 2] === word[j - 1]) best = Math.min(best, rows[i - 2][j - 2] + 1);
      rows[i][j] = best;
    }
  }
  return Math.min(...rows[q]);
}

/** Typos forgiven in a typed word of this length: none for short words, more for long ones. */
function allowedTypos(length: number): number {
  return length <= 3 ? 0 : length <= 7 ? 1 : 2;
}

/**
 * How well a query fits a name, higher is better; null when it doesn't.
 * Whole name > start of the name > every typed word starting a word of the
 * name (in order beats out of order) > anywhere in the name > with typos.
 */
function matchScore(query: string, queryWords: Word[], name: string): number | null {
  const lowerName = name.trim().replace(/\s+/g, ' ').toLowerCase();
  if (lowerName === query) return 100;
  if (lowerName.startsWith(query)) return 80;

  const nameWords = words(name);
  // Each typed word claims the best unclaimed word of the name.
  const used = new Set<number>();
  let typos = 0;
  let inOrder = true;
  let last = -1;
  for (const qw of queryWords) {
    let best: { at: number; typos: number } | null = null;
    nameWords.forEach((nw, at) => {
      if (used.has(at)) return;
      const t = nw.lower.startsWith(qw.lower) ? 0 : prefixDistance(qw.lower, nw.lower);
      if (t <= allowedTypos(qw.lower.length) && (!best || t < best.typos)) best = { at, typos: t };
    });
    if (!best) return lowerName.includes(query) ? 40 : null;
    const { at, typos: t } = best;
    used.add(at);
    typos += t;
    if (at < last) inOrder = false;
    last = at;
  }
  if (typos === 0) return inOrder ? 60 : 50;
  return lowerName.includes(query) ? 40 : 30 - 5 * typos;
}

/** Extra rank for pages opened lately or kept in the same folder (smaller than the gaps between match kinds). */
function nearness(page: SearchablePage, context: SearchContext): number {
  const recent = context.recentPageIds.indexOf(page.pageId);
  return (recent >= 0 ? Math.max(1, 8 - recent) : 0) + (page.folderId === context.folderId ? 2 : 0);
}

/**
 * Pages that fit the query, best first. A blank query lists recently opened
 * and nearby pages first, then the rest by title.
 */
export function searchPages(query: string, pages: SearchablePage[], context: SearchContext, limit = MAX_RESULTS): PageResult[] {
  const q = query.trim().replace(/\s+/g, ' ').toLowerCase();
  const queryWords = words(q);
  const scored: { result: PageResult; score: number }[] = [];
  for (const page of pages) {
    if (page.pageId === context.currentPageId) continue;
    let best: { name: string; viaAlias: boolean; score: number } | null = null;
    const names = [{ name: page.title, viaAlias: false }, ...page.aliases.map((name) => ({ name, viaAlias: true }))];
    for (const { name, viaAlias } of names) {
      const score = q ? (queryWords.length ? matchScore(q, queryWords, name) : name.toLowerCase().includes(q) ? 40 : null) : 0;
      // An alias has to do better than the title to be the name shown.
      if (score !== null && (!best || score > best.score)) best = { name, viaAlias, score };
    }
    if (best) {
      scored.push({
        result: { pageId: page.pageId, name: best.name, viaAlias: best.viaAlias, type: page.type },
        score: best.score + nearness(page, context),
      });
    }
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.result.name.length - b.result.name.length ||
      a.result.name.localeCompare(b.result.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
  return scored.slice(0, limit).map((s) => s.result);
}

/** The trailing words of `text`, joined by nothing but spaces, ending at the very end of the text; nearest last. */
function trailingWords(text: string): Word[] {
  const all = words(text);
  const tail = all[all.length - 1];
  if (!tail || tail.index + tail.text.length !== text.length) return [];
  const run = [tail];
  for (let i = all.length - 2; i >= 0 && run.length < MAX_MENTION_WORDS; i--) {
    const gap = text.slice(all[i].index + all[i].text.length, run[0].index);
    if (!/^\s+$/.test(gap)) break;
    run.unshift(all[i]);
  }
  return run;
}

/**
 * The page name typed words fit, as a run of the name's words: the typed
 * words equal the name's, except the last, which only has to start it
 * (unless `wholeLast`). Returns where in the name the run starts and the
 * matched last word.
 */
function fitInName(typed: Word[], nameWords: Word[], wholeLast = false): { at: number; word: Word }[] {
  const fits: { at: number; word: Word }[] = [];
  for (let at = 0; at + typed.length <= nameWords.length; at++) {
    const ok = typed.every((t, k) => {
      const nw = nameWords[at + k];
      return k === typed.length - 1 && !wholeLast ? nw.lower.startsWith(t.lower) : nw.lower === t.lower;
    });
    if (ok) fits.push({ at, word: nameWords[at + typed.length - 1] });
  }
  return fits;
}

/**
 * How the words just typed (the end of `text`) would finish as a mention of
 * a page, when one page is the clear answer. Prefers a mention that
 * completes a whole name ("Thal" finishes as the page "Thalamar", not "The
 * Thalamar Imperium"), then one spanning more of the typed words, then one
 * starting the name, then nearby pages. Offers nothing when the word typed
 * could already be finished (it is a whole word of some name), when it is
 * short or common, or when two pages tie.
 */
export function completionAt(text: string, pages: SearchablePage[], context: SearchContext): Completion | null {
  const typed = trailingWords(text);
  const current = typed[typed.length - 1];
  if (!current || current.lower.length < MIN_TYPED || COMMON_WORDS.has(current.lower)) return null;

  type Candidate = Completion & { whole: boolean; span: number; atStart: boolean; near: number };
  const candidates: Candidate[] = [];
  for (const page of pages) {
    if (page.pageId === context.currentPageId) continue;
    for (const name of [page.title, ...page.aliases]) {
      const nameWords = words(name);
      for (let span = 1; span <= typed.length; span++) {
        const run = typed.slice(typed.length - span);
        for (const { at, word } of fitInName(run, nameWords)) {
          // The typed word is already a whole word of this name: the writer may be done, so finishing it would get in the way.
          if (word.lower === current.lower) return null;
          const rest = word.text.slice(current.text.length);
          if (rest.length < MIN_REST || COMMON_WORDS.has(word.lower)) continue;
          candidates.push({
            pageId: page.pageId,
            from: run[0].index,
            rest,
            whole: at === 0 && span === nameWords.length,
            span,
            atStart: at === 0,
            near: nearness(page, context),
          });
        }
      }
    }
  }
  if (!candidates.length) return null;

  const rank = (c: Candidate) => [Number(c.whole), c.span, Number(c.atStart), c.near];
  const compare = (a: Candidate, b: Candidate) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return rb[i] - ra[i];
    return 0;
  };
  candidates.sort(compare);
  const [best, next] = candidates;
  if (next && next.pageId !== best.pageId && compare(best, next) === 0) return null;
  return { pageId: best.pageId, from: best.from, rest: best.rest };
}

/**
 * What the words just before the caret (the end of `text`) mention, for Tab
 * when no completion shows. A whole page name (title or alias, a plural
 * counts) gives that page; failing that, whole words of exactly one page's
 * name give that page ("Mira" for "Mira Thorne"). Several pages fitting, or
 * a word that only starts a name, give `pageId: null`: the writer picks from
 * a list. More typed words win over fewer. `from` is where the mention starts.
 */
export function mentionBefore(text: string, pages: SearchablePage[], context: SearchContext): { pageId: Id | null; from: number } | null {
  const typed = trailingWords(text);
  const current = typed[typed.length - 1];
  if (!current) return null;
  const others = pages.filter((p) => p.pageId !== context.currentPageId);
  const nameWordsOf = (p: SearchablePage) => [p.title, ...p.aliases].map(words);
  const singular = (w: Word): Word => ({ ...w, lower: w.lower.replace(/e?s$/, '') });
  // A lone common word ("the") is never a mention, though names start with it.
  const usable = (run: Word[]) => run.length > 1 || !COMMON_WORDS.has(run[0].lower);
  const answer = (found: Set<Id>, from: number) => ({ pageId: found.size === 1 ? [...found][0] : null, from });

  for (let span = typed.length; span >= 1; span--) {
    const run = typed.slice(typed.length - span);
    if (!usable(run)) continue;
    const plural = [...run.slice(0, -1), singular(run[run.length - 1])];
    const exact = new Set(
      others
        .filter((p) => nameWordsOf(p).some((nw) => nw.length === span && [run, plural].some((r) => fitInName(r, nw, true).some((f) => f.at === 0))))
        .map((p) => p.pageId),
    );
    if (exact.size) return answer(exact, run[0].index);
  }
  for (const wholeLast of [true, false]) {
    for (let span = typed.length; span >= 1; span--) {
      const run = typed.slice(typed.length - span);
      if (!usable(run)) continue;
      const fits = new Set(others.filter((p) => nameWordsOf(p).some((nw) => fitInName(run, nw, wholeLast).length)).map((p) => p.pageId));
      // Only part of a word typed: finishing it takes a choice, even with one page.
      if (fits.size) return wholeLast ? answer(fits, run[0].index) : { pageId: null, from: run[0].index };
    }
  }
  return null;
}

/**
 * The rest of the last typed word if the typed words begin a run of `name`'s
 * words ("everst" in "The Veilstrand and the Everstorm" gives "orm"; a whole
 * word gives ""), or null when they don't fit the name that way.
 */
export function restOfWordIn(typedText: string, name: string): string | null {
  const typed = words(typedText);
  const current = typed[typed.length - 1];
  if (!current) return null;
  const fits = fitInName(typed, words(name));
  return fits.length ? fits[0].word.text.slice(current.text.length) : null;
}
