import { describe, expect, it } from 'vitest';
import { completionAt, prefixDistance, restOfWordIn, searchPages, type SearchablePage, type SearchContext } from './pageSearch';

const page = (pageId: string, title: string, extra: Partial<SearchablePage> = {}): SearchablePage => ({
  pageId,
  title,
  aliases: [],
  type: 'note',
  folderId: null,
  ...extra,
});

const pages = [
  page('storm', 'The Veilstrand and the Everstorm', { type: 'place' }),
  page('imperium', 'The Thalamar Imperium', { type: 'faction', aliases: ['the Imperium'] }),
  page('thalamar', 'Thalamar', { type: 'character' }),
  page('cult', 'Veil Cult'),
  page('market', 'Veiled Market'),
  page('mira', 'Mira Thorne', { aliases: ['Thorny'] }),
  page('here', 'Current page'),
];

const context: SearchContext = { currentPageId: 'here', folderId: null, recentPageIds: [] };

/** The ids found for a query. */
const ids = (query: string, ctx = context) => searchPages(query, pages, ctx).map((r) => r.pageId);

/** The completion for some typed text, as [mention so far, rest, page]. */
function complete(text: string, ctx = context) {
  const c = completionAt(text, pages, ctx);
  return c && [text.slice(c.from), c.rest, c.pageId];
}

describe('fuzzy prefixes', () => {
  it('counts edits to the nearest prefix', () => {
    expect(prefixDistance('veil', 'veilstrand')).toBe(0);
    expect(prefixDistance('vielst', 'veilstrand')).toBe(1);
    expect(prefixDistance('veilstrnd', 'veilstrand')).toBe(1);
    expect(prefixDistance('xyz', 'veil')).toBe(3);
  });
});

describe('page search', () => {
  it('matches any word of a title', () => {
    expect(ids('everst')).toEqual(['storm']);
  });

  it('forgives typos in longer words', () => {
    expect(ids('evrstorm')).toEqual(['storm']);
    expect(ids('Veilstrnd')).toContain('storm');
  });

  it('ranks the whole name, then the start of a name, before other matches', () => {
    expect(ids('thalamar')).toEqual(['thalamar', 'imperium']);
    expect(ids('veil')[0]).toBe('cult');
  });

  it('matches aliases and says so', () => {
    const [result] = searchPages('thorny', pages, context);
    expect(result).toEqual({ pageId: 'mira', name: 'Thorny', viaAlias: true, type: 'note' });
  });

  it('never offers the page being edited', () => {
    expect(ids('current')).toEqual([]);
  });

  it('puts recently opened pages first among equal matches', () => {
    expect(ids('veil', { ...context, recentPageIds: ['market'] })[0]).toBe('market');
  });

  it('lists recent pages first when nothing is typed', () => {
    expect(ids('', { ...context, recentPageIds: ['mira'] })[0]).toBe('mira');
  });
});

describe('completion', () => {
  it('finishes a word in the middle of a title', () => {
    expect(complete('We sailed into everst')).toEqual(['everst', 'orm', 'storm']);
    // Words before it that are in the title too become part of the mention.
    expect(complete('We sailed into the everst')).toEqual(['the everst', 'orm', 'storm']);
  });

  it('spans the typed words that start the title', () => {
    expect(complete('Then the Veilstr')).toEqual(['the Veilstr', 'and', 'storm']);
  });

  it('prefers the page whose whole name it completes', () => {
    expect(complete('We met Thal')).toEqual(['Thal', 'amar', 'thalamar']);
  });

  it('completes aliases', () => {
    expect(complete('ask Thor')).toEqual(['Thor', 'ny', 'mira']);
  });

  it('stays quiet for short, common or already whole words', () => {
    expect(complete('Th')).toBeNull();
    expect(complete('and')).toBeNull();
    // "Veil" is already a whole word of "Veil Cult".
    expect(complete('the Veil')).toBeNull();
  });

  it('stays quiet when the text does not end in a word', () => {
    expect(complete('everst ')).toBeNull();
  });
});

describe('finishing a typed word inside a chosen name', () => {
  it('gives the rest of the word', () => {
    expect(restOfWordIn('everst', 'The Veilstrand and the Everstorm')).toBe('orm');
    expect(restOfWordIn('Everstorm', 'The Veilstrand and the Everstorm')).toBe('');
  });

  it('is null when the words do not fit the name', () => {
    expect(restOfWordIn('evrst', 'The Veilstrand and the Everstorm')).toBeNull();
  });
});
