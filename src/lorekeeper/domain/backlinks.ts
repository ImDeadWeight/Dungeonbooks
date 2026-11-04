/**
 * @file Backlinks: which pages link to a page ("Linked from"), and which
 * name it in text that isn't linked yet ("Mentioned in"). Works on the
 * saved editor JSON, so no editor needs to be open.
 */
import type { JSONContent } from '@tiptap/core';
import { linkMentions } from './autolink';
import type { Id } from './ids';
import { byName, type Page } from './notebook';
import type { TitleMatcher } from './titleMatcher';

const PAGE_LINK = 'pageLink';
/** Characters kept either side of a link or mention in its snippet. */
const SNIPPET_CONTEXT = 40;

/** Another page pointing at this one, with a line of text around the first place it does. */
export interface Backlink {
  page: Page;
  snippet: string;
  /** How many times that page links to (or mentions) this one. */
  count: number;
}

/** A piece of a text block: its text, and the page it links to (null when unlinked). */
interface Piece {
  text: string;
  pageId: Id | null;
  /** A line break or chip: mentions never run across it. */
  boundary?: boolean;
}

const linkOf = (node: JSONContent): Id | null =>
  (node.marks?.find((m) => m.type === PAGE_LINK)?.attrs?.pageId as Id | undefined) ?? null;

/** Every block of text in a document (paragraphs, headings, list items' paragraphs) as pieces. */
function textBlocks(doc: JSONContent): Piece[][] {
  const blocks: Piece[][] = [];
  const walk = (node: JSONContent) => {
    if (node.content?.some((c) => c.type === 'text')) {
      blocks.push(node.content.map((c) => (c.type === 'text' ? { text: c.text ?? '', pageId: linkOf(c) } : { text: ' ', pageId: null, boundary: true })));
      return;
    }
    node.content?.forEach(walk);
  };
  walk(doc);
  return blocks;
}

/** The block's text cut to a window around [from, to), with … where it was cut. */
function snippetAround(text: string, from: number, to: number): string {
  const start = Math.max(0, from - SNIPPET_CONTEXT);
  const end = Math.min(text.length, to + SNIPPET_CONTEXT);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/** Adds one hit to the backlinks of `target` from `page` (the first hit gives the snippet). */
function addHit(index: Map<Id, Backlink[]>, target: Id, page: Page, snippet: () => string) {
  const list = index.get(target) ?? [];
  const existing = list.find((b) => b.page.id === page.id);
  if (existing) existing.count++;
  else list.push({ page, snippet: snippet(), count: 1 });
  index.set(target, list);
}

const sorted = (index: Map<Id, Backlink[]>) => {
  for (const list of index.values()) list.sort((a, b) => byName(a.page.title, b.page.title));
  return index;
};

/** For every page, the other pages that link to it (in text, or by a pin on a map). Links from a page to itself don't count. */
export function linkedFromIndex(pages: Page[]): Map<Id, Backlink[]> {
  const index = new Map<Id, Backlink[]>();
  for (const page of pages) {
    for (const image of page.images ?? []) {
      for (const pin of image.pins ?? []) {
        if (pin.pageId !== page.id) addHit(index, pin.pageId, page, () => `Pinned on ${image.caption ? `the map "${image.caption}"` : 'a map'}`);
      }
    }
    for (const box of page.boxes) {
      for (const block of textBlocks(box.content)) {
        const text = block.map((p) => p.text).join('');
        let at = 0;
        for (const piece of block) {
          const from = at;
          at += piece.text.length;
          if (!piece.pageId || piece.pageId === page.id) continue;
          addHit(index, piece.pageId, page, () => snippetAround(text, from, from + piece.text.length));
        }
      }
    }
  }
  return sorted(index);
}

/**
 * For every page, the other pages whose unlinked text names it. One matcher
 * for every page's names serves all pages; a page naming itself is skipped.
 */
export function mentionedInIndex(pages: Page[], matcher: TitleMatcher): Map<Id, Backlink[]> {
  const index = new Map<Id, Backlink[]>();
  for (const page of pages) {
    for (const box of page.boxes) {
      for (const block of textBlocks(box.content)) {
        const text = block.map((p) => p.text).join('');
        // Runs of unlinked text, so a mention never spans a link.
        let at = 0;
        let runStart = 0;
        let run = '';
        const flush = () => {
          for (const m of matcher.find(run)) {
            if (m.pageId === page.id) continue;
            addHit(index, m.pageId, page, () => snippetAround(text, runStart + m.from, runStart + m.to));
          }
        };
        for (const piece of block) {
          if (piece.pageId || piece.boundary) {
            flush();
            run = '';
            runStart = at + piece.text.length;
          } else {
            run += piece.text;
          }
          at += piece.text.length;
        }
        flush();
      }
    }
  }
  return sorted(index);
}

/**
 * A page's boxes with every unlinked mention of `targetId` linked (the
 * Mentioned in list's Link button). Only boxes that changed are returned.
 */
export function linkMentionsOf(page: Page, matcher: TitleMatcher, targetId: Id): { boxId: Id; content: JSONContent }[] {
  const onlyTarget: TitleMatcher = { find: (text) => matcher.find(text).filter((m) => m.pageId === targetId) };
  return page.boxes.flatMap((box) => {
    const result = linkMentions(box.content, onlyTarget);
    return result.linked.length ? [{ boxId: box.id, content: result.doc }] : [];
  });
}
