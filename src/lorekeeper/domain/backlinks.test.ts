import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { linkedFromIndex, linkMentionsOf, mentionedInIndex } from './backlinks';
import { linkCandidates } from './linkCandidates';
import type { Page } from './notebook';
import { createTitleMatcher } from './titleMatcher';

const text = (t: string, linkTo?: string): JSONContent =>
  linkTo ? { type: 'text', text: t, marks: [{ type: 'pageLink', attrs: { pageId: linkTo } }] } : { type: 'text', text: t };
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content: [{ type: 'paragraph', content }] });
const page = (id: string, title: string, ...docs: JSONContent[]): Page => ({
  id,
  title,
  folderId: null,
  boxes: docs.map((content, i) => ({ id: `${id}-${i}`, x: 0, y: 0, width: 300, content })),
});

const vaultrock = page('vault', 'Vaultrock', doc(text('The mines under '), text('Vaultrock', 'vault')));
const mira = page('mira', 'Mira Thorne', doc(text('Mira was born in '), text('Vaultrock', 'vault'), text('.')), doc(text('Back to the vaultrock')));
const storm = page('storm', 'Everstorm', doc(text('Seen from Vaultrock and from '), text('Mira', 'mira'), text(' Thorne\'s ship.')));
const pages = [vaultrock, mira, storm];
const matcher = createTitleMatcher(linkCandidates(pages));

describe('linked from', () => {
  it('lists the pages linking to a page, by name, with a snippet and a count', () => {
    const index = linkedFromIndex(pages);
    expect(index.get('vault')).toEqual([{ page: mira, snippet: 'Mira was born in Vaultrock.', count: 1 }]);
    expect(index.get('mira')?.map((b) => b.page.id)).toEqual(['storm']);
  });

  it('leaves out a page linking to itself', () => {
    expect(linkedFromIndex([vaultrock]).get('vault')).toBeUndefined();
  });
});

describe('mentioned in', () => {
  it('finds unlinked mentions, any case, counting each one', () => {
    const index = mentionedInIndex(pages, matcher);
    // By name: Everstorm, then Mira Thorne ("vaultrock" in lower case still counts).
    expect(index.get('vault')?.map((b) => [b.page.id, b.count])).toEqual([
      ['storm', 1],
      ['mira', 1],
    ]);
  });

  it("doesn't count linked text, or a mention split by a link", () => {
    // "Mira" is linked and " Thorne" follows it: not a mention of Mira Thorne.
    expect(mentionedInIndex(pages, matcher).get('mira')).toBeUndefined();
  });

  it("doesn't run a mention across a line break", () => {
    const split = page('x', 'Notes', { type: 'doc', content: [{ type: 'paragraph', content: [text('Ever'), { type: 'hardBreak' }, text('storm')] }] });
    const all = [split, storm];
    expect(mentionedInIndex(all, createTitleMatcher(linkCandidates(all))).get('storm')).toBeUndefined();
  });

  it('cuts long snippets around the mention', () => {
    const long = page('long', 'Long', doc(text(`${'a'.repeat(80)} Everstorm ${'b'.repeat(80)}`)));
    const all = [long, storm];
    const [hit] = mentionedInIndex(all, createTitleMatcher(linkCandidates(all))).get('storm')!;
    expect(hit.snippet.startsWith('…')).toBe(true);
    expect(hit.snippet.endsWith('…')).toBe(true);
    expect(hit.snippet).toContain('Everstorm');
  });
});

describe('linking mentions of one page', () => {
  it('links only that page, and returns only the boxes that changed', () => {
    const changed = linkMentionsOf(mira, matcher, 'vault');
    expect(changed.map((c) => c.boxId)).toEqual(['mira-1']);
    expect(changed[0].content.content![0].content).toEqual([text('Back to the '), text('vaultrock', 'vault')]);
  });
});
