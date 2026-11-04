/**
 * @file Linking every unlinked mention of other pages in saved page text:
 * what clicking each suggestion's link button would do, done all at once
 * (for AI apps' "link mentions"). Works on the editor's JSON, so it needs no
 * open editor.
 */
import type { JSONContent } from '@tiptap/core';
import type { Id } from './ids';
import type { TitleMatcher } from './titleMatcher';

const PAGE_LINK = 'pageLink';

const isUnlinkedText = (node: JSONContent) => node.type === 'text' && !node.marks?.some((m) => m.type === PAGE_LINK);

/**
 * Splits a run of unlinked text nodes so every match becomes its own node
 * carrying a page link (keeping the nodes' other marks).
 */
function linkRun(run: JSONContent[], matcher: TitleMatcher, linked: Set<Id>): JSONContent[] {
  const text = run.map((n) => n.text ?? '').join('');
  const matches = matcher.find(text);
  if (!matches.length) return run;
  const out: JSONContent[] = [];
  let offset = 0;
  for (const node of run) {
    const nodeText = node.text ?? '';
    const start = offset;
    const end = offset + nodeText.length;
    offset = end;
    // Cut points inside this node, with the page linked from each cut to the next (null: unlinked).
    let at = start;
    const pieces: { from: number; to: number; pageId: Id | null }[] = [];
    for (const m of matches) {
      if (m.to <= start || m.from >= end) continue;
      const from = Math.max(m.from, start);
      const to = Math.min(m.to, end);
      if (from > at) pieces.push({ from: at, to: from, pageId: null });
      pieces.push({ from, to, pageId: m.pageId });
      at = to;
    }
    if (at < end) pieces.push({ from: at, to: end, pageId: null });
    for (const piece of pieces) {
      const pieceText = nodeText.slice(piece.from - start, piece.to - start);
      if (!piece.pageId) {
        out.push({ ...node, text: pieceText });
        continue;
      }
      linked.add(piece.pageId);
      out.push({ ...node, text: pieceText, marks: [...(node.marks ?? []), { type: PAGE_LINK, attrs: { pageId: piece.pageId } }] });
    }
  }
  return out;
}

/** A document with every unlinked mention linked, and the pages now linked to (none: the same document back). */
export function linkMentions(doc: JSONContent, matcher: TitleMatcher): { doc: JSONContent; linked: Id[] } {
  const linked = new Set<Id>();
  const walk = (node: JSONContent): JSONContent => {
    if (!node.content) return node;
    const content: JSONContent[] = [];
    let run: JSONContent[] = [];
    const flush = () => {
      if (run.length) content.push(...linkRun(run, matcher, linked));
      run = [];
    };
    for (const child of node.content) {
      if (isUnlinkedText(child)) {
        run.push(child);
        continue;
      }
      flush();
      content.push(walk(child));
    }
    flush();
    return { ...node, content };
  };
  const result = walk(doc);
  return linked.size ? { doc: result, linked: [...linked] } : { doc, linked: [] };
}
