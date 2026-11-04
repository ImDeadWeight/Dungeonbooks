/**
 * @file The names text can link to: every page's title and aliases. Titles
 * come first, so a title wins over another page's alias.
 */
import type { Id } from './ids';
import type { Page } from './notebook';
import type { LinkCandidate } from './titleMatcher';

/** Titles then aliases of the given pages, leaving out `exceptId` (a page never links to itself). */
export function linkCandidates(pages: Pick<Page, 'id' | 'title' | 'aliases'>[], exceptId?: Id): LinkCandidate[] {
  const others = exceptId ? pages.filter((p) => p.id !== exceptId) : pages;
  return [
    ...others.map((p) => ({ pageId: p.id, title: p.title })),
    ...others.flatMap((p) => (p.aliases ?? []).map((title) => ({ pageId: p.id, title }))),
  ];
}
