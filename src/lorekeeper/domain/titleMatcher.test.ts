import { describe, expect, it } from 'vitest';
import { createTitleMatcher } from './titleMatcher';

const pages = [
  { pageId: 'imperium', title: 'The Thalamar Imperium' },
  { pageId: 'veil', title: 'Veilstrand' },
  { pageId: 'thalamar', title: 'Thalamar' },
];

/** The matched text and page for each match. */
function found(text: string, candidates = pages) {
  return createTitleMatcher(candidates).find(text).map((m) => [text.slice(m.from, m.to), m.pageId]);
}

describe('title matching', () => {
  it('finds every page title in a sentence', () => {
    expect(found('The Thalamar Imperium is the primary political power in the Veilstrand')).toEqual([
      ['The Thalamar Imperium', 'imperium'],
      ['Veilstrand', 'veil'],
    ]);
  });

  it('ignores case and extra whitespace', () => {
    expect(found('the  thalamar\nimperium')).toEqual([['the  thalamar\nimperium', 'imperium']]);
  });

  it('falls back to a shorter title when the longer one is not present', () => {
    expect(found('Thalamar Imperium')).toEqual([['Thalamar', 'thalamar']]);
  });

  it('needs whole words', () => {
    expect(found('Veilstrands and preVeilstrand')).toEqual([]);
    expect(found("Veilstrand's coast, (Veilstrand).")).toEqual([
      ['Veilstrand', 'veil'],
      ['Veilstrand', 'veil'],
    ]);
  });

  it('treats regex characters in titles literally', () => {
    expect(found('Visit Ka(r)n and Karn', [{ pageId: 'k', title: 'Ka(r)n' }])).toEqual([['Ka(r)n', 'k']]);
  });

  it('skips one-character and blank titles', () => {
    expect(found('A b', [{ pageId: 'a', title: 'A' }, { pageId: 'blank', title: '  ' }])).toEqual([]);
  });

  it('uses the first page when titles are duplicated', () => {
    expect(found('Veilstrand', [{ pageId: 'one', title: 'Veilstrand' }, { pageId: 'two', title: 'veilstrand' }])).toEqual([
      ['Veilstrand', 'one'],
    ]);
  });
});
