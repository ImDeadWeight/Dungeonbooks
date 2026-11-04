import { describe, expect, it } from 'vitest';
import { linkMentions } from './autolink';
import { createTitleMatcher } from './titleMatcher';

const matcher = createTitleMatcher([
  { pageId: 'storm', title: 'Everstorm' },
  { pageId: 'mira', title: 'Mira Thorne' },
]);

const paragraph = (...content: object[]) => ({ type: 'doc', content: [{ type: 'paragraph', content }] });

describe('linking mentions', () => {
  it('links mentions, also across bold and plain text, keeping other marks', () => {
    const doc = paragraph({ type: 'text', text: 'Then ' }, { type: 'text', text: 'Mira', marks: [{ type: 'bold' }] }, { type: 'text', text: ' Thorne left.' });
    const { doc: result, linked } = linkMentions(doc, matcher);
    expect(linked).toEqual(['mira']);
    expect(result.content![0].content).toEqual([
      { type: 'text', text: 'Then ' },
      { type: 'text', text: 'Mira', marks: [{ type: 'bold' }, { type: 'pageLink', attrs: { pageId: 'mira' } }] },
      { type: 'text', text: ' Thorne', marks: [{ type: 'pageLink', attrs: { pageId: 'mira' } }] },
      { type: 'text', text: ' left.' },
    ]);
  });

  it('leaves existing links and text across a line break alone', () => {
    const link = { type: 'text', text: 'Everstorm', marks: [{ type: 'pageLink', attrs: { pageId: 'other' } }] };
    const doc = paragraph(link, { type: 'text', text: ' Mira' }, { type: 'hardBreak' }, { type: 'text', text: 'Thorne' });
    expect(linkMentions(doc, matcher)).toEqual({ doc, linked: [] });
  });

  it('links in lists and headings', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'the Everstorm' }] }] }] }],
    };
    expect(linkMentions(doc, matcher).linked).toEqual(['storm']);
  });
});
