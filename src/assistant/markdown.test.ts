import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown, type LinkNames } from './markdown';

const titles: Record<string, string> = { storm: 'The Everstorm', mira: 'Mira Thorne' };
const names: LinkNames = {
  titleOf: (id) => titles[id],
  pageNamed: (name) => {
    const lower = name.toLowerCase();
    if (lower === 'thorny') return 'mira';
    return Object.keys(titles).find((id) => titles[id].toLowerCase() === lower);
  },
};

/** Markdown → document → Markdown. */
const roundTrip = (md: string) => toMarkdown(fromMarkdown(md, names).doc, names);

describe('markdown', () => {
  it('round-trips the blocks the editor has', () => {
    const md = [
      '# Session 3',
      'We **sailed** into *fog* and ~~lost~~ found `the map`.\\\nNew line.',
      '- one\n- two\n  - nested',
      '1. first\n2. second',
      '> a quote',
      '---',
    ].join('\n\n');
    expect(roundTrip(md)).toBe(md);
  });

  it('reads [[links]] by title or alias, keeping the words shown', () => {
    const { doc, unknownLinks } = fromMarkdown('Ask [[thorny]] about [[The Everstorm|the storm]] and [[Brannoc]].', names);
    const linked = doc.content![0].content!.filter((n) => n.marks?.some((m) => m.type === 'pageLink'));
    expect(linked.map((n) => [n.text, n.marks![0].attrs!.pageId])).toEqual([
      ['thorny', 'mira'],
      ['the storm', 'storm'],
    ]);
    expect(unknownLinks).toEqual(['Brannoc']);
  });

  it('writes links as [[Title]], or [[Title|words]] when the words differ', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Mira Thorne', marks: [{ type: 'pageLink', attrs: { pageId: 'mira' } }] },
            { type: 'text', text: ' saw ' },
            { type: 'text', text: 'the storm', marks: [{ type: 'pageLink', attrs: { pageId: 'storm' } }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'a ghost', marks: [{ type: 'pageLink', attrs: { pageId: 'deleted' } }] },
            { type: 'encounterLink', attrs: { encounterId: 'e1', name: 'Ambush' } },
          ],
        },
      ],
    };
    expect(toMarkdown(doc, names)).toBe('[[Mira Thorne]] saw [[The Everstorm|the storm]] and a ghost[encounter: Ambush]');
  });

  it('leaves lone asterisks and snake_case alone', () => {
    expect(roundTrip('5 * 3 and snake_case_name')).toBe('5 * 3 and snake_case_name');
  });

  it('gives an empty paragraph for empty text', () => {
    expect(fromMarkdown('  \n', names).doc).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
});
