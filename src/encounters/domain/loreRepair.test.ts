import { makeLorekeeperCatalog } from 'campaign-link';
import { describe, expect, it } from 'vitest';
import { repairedLoreRefs } from './loreRepair';

const copy = makeLorekeeperCatalog('nb-new', 'Veilstrand', [
  { id: 'p1', title: 'Cassian Dray', info: { type: 'character', kind: 'npc' } },
]);

describe('repairedLoreRefs', () => {
  it('points a character whose notebook is gone at the notebook its page is in now', () => {
    const templates = [{ id: 't1', lore: { notebookId: 'nb-old', pageId: 'p1' } }];
    expect(repairedLoreRefs(templates, new Set(['nb-new']), [copy])).toEqual(new Map([['t1', { notebookId: 'nb-new', pageId: 'p1' }]]));
  });

  it('leaves characters whose notebook is still here', () => {
    const templates = [{ id: 't1', lore: { notebookId: 'nb-old', pageId: 'p1' } }];
    expect(repairedLoreRefs(templates, new Set(['nb-old', 'nb-new']), [copy]).size).toBe(0);
  });

  it('leaves characters whose page is nowhere, and characters without a page', () => {
    const templates = [
      { id: 't1', lore: { notebookId: 'nb-old', pageId: 'p9' } },
      { id: 't2' },
    ];
    expect(repairedLoreRefs(templates, new Set(['nb-new']), [copy]).size).toBe(0);
  });
});
