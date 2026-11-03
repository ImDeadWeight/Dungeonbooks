import { describe, expect, it } from 'vitest';
import { suggestLoreCharacters, type LoreCharacter } from './loreSuggestions';

const page = (title: string): LoreCharacter => ({ notebookId: 'nb', pageId: title, title, kind: 'npc', notebookName: 'Veilstrand' });
const pages = ['Cassian Dray', 'Carian', 'Danny', "Kaede Honjou", 'Ysolt Farrow', 'Garrik'].map(page);
const titles = (typed: string) => suggestLoreCharacters(pages, typed).map((c) => c.title);

describe('Lorekeeper name suggestions', () => {
  it('suggests nothing until something is typed', () => {
    expect(titles('  ')).toEqual([]);
  });

  it('puts titles that start with the text first, ignoring case', () => {
    expect(titles('ca')).toEqual(['Carian', 'Cassian Dray']);
    expect(titles('CAR')).toEqual(['Carian']);
  });

  it('also finds a later word', () => {
    expect(titles('dra')).toEqual(['Cassian Dray']);
    expect(titles('honjou')).toEqual(['Kaede Honjou']);
  });

  it('does not match the middle of a word', () => {
    expect(titles('arri')).toEqual([]);
  });
});
