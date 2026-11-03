import { describe, expect, it } from 'vitest';
import { planUnify } from './unifyPlan';

describe('planUnify', () => {
  it('makes a linked campaign and notebook one campaign, under the campaign id', () => {
    const plan = planUnify({
      campaigns: [{ id: 'c1', name: 'Veilstrand', formatId: 'dnd5e' }],
      notebooks: [{ id: 'n1', name: 'Veilstrand notes' }],
      activeNotebookId: 'n1',
      links: { c1: 'n1' },
    });
    expect(plan).toEqual({ campaigns: [{ id: 'c1', name: 'Veilstrand', formatId: 'dnd5e' }], activeId: 'c1', notebookMoves: { n1: 'c1' } });
  });

  it('keeps unlinked campaigns and turns unlinked notebooks into campaigns', () => {
    const plan = planUnify({
      campaigns: [{ id: 'c1', name: 'One' }],
      notebooks: [{ id: 'n2', name: 'one' }],
      activeNotebookId: 'n2',
      links: {},
    });
    expect(plan.campaigns).toEqual([
      { id: 'c1', name: 'One', formatId: null },
      { id: 'n2', name: 'one (2)', formatId: null },
    ]);
    expect(plan.activeId).toBe('n2');
    expect(plan.notebookMoves).toEqual({});
  });

  it('ignores links to things that no longer exist', () => {
    const plan = planUnify({ campaigns: [{ id: 'c1', name: 'One' }], notebooks: [], activeNotebookId: 'gone', links: { c1: 'gone', c9: 'n1' } });
    expect(plan).toEqual({ campaigns: [{ id: 'c1', name: 'One', formatId: null }], activeId: null, notebookMoves: {} });
  });
});
