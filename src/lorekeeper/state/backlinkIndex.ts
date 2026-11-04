/**
 * @file The open notes' backlinks, worked out once per change to the pages
 * and shared by everything that shows them (the page, the peek panel, AI
 * apps' read_page).
 */
import { linkedFromIndex, mentionedInIndex, type Backlink } from '../domain/backlinks';
import type { Id } from '../domain/ids';
import { linkCandidates } from '../domain/linkCandidates';
import type { Page } from '../domain/notebook';
import { createTitleMatcher } from '../domain/titleMatcher';

/** Both lists for one page. */
export interface PageBacklinks {
  linkedFrom: Backlink[];
  mentionedIn: Backlink[];
}

const NONE: Backlink[] = [];

let cached: { pages: Page[]; linked: Map<Id, Backlink[]>; mentioned: Map<Id, Backlink[]> } | null = null;

/** The backlinks of `pageId` among `pages` (the indexes are rebuilt only when `pages` changes). */
export function backlinksOf(pages: Page[], pageId: Id): PageBacklinks {
  if (cached?.pages !== pages) {
    const matcher = createTitleMatcher(linkCandidates(pages));
    cached = { pages, linked: linkedFromIndex(pages), mentioned: mentionedInIndex(pages, matcher) };
  }
  return { linkedFrom: cached.linked.get(pageId) ?? NONE, mentionedIn: cached.mentioned.get(pageId) ?? NONE };
}
