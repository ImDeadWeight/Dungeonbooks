import { describe, expect, it } from 'vitest';
import type { Folder, Page } from '../../lorekeeper/domain/notebook';
import { addChange, AI_CHANGES_LIMIT, captureChange, changedSince, undoChange, type AiChange } from './aiChanges';

const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const page = (id: string, text: string, extra: Partial<Page> = {}): Page => ({
  id,
  title: id,
  folderId: null,
  boxes: [{ id: `${id}-box`, x: 0, y: 0, width: 300, content: doc(text) }],
  ...extra,
});
const meta = { id: 'c1', at: 1, source: 'assistant' as const, label: 'Change' };
let counter = 0;
const newId = () => `new-${++counter}`;

const vault = page('vault', 'The mines');
const mira = page('mira', 'Born in Vaultrock');
const before = { folders: [] as Folder[], pages: [vault, mira] };

describe('capturing a change', () => {
  it('keeps only the pages the call touched, before and after', () => {
    const edited = { ...mira, boxes: [{ ...mira.boxes[0], content: doc('Left Vaultrock') }] };
    const change = captureChange(before, { folders: [], pages: [vault, edited] }, meta)!;
    expect(change.before).toEqual([mira]);
    expect(change.after).toEqual([edited]);
    expect(change.createdPageIds).toEqual([]);
  });

  it('notes pages and folders it made', () => {
    const folder: Folder = { id: 'f', name: 'Places', parentId: null };
    const made = page('pit', 'Gladiators', { folderId: 'f' });
    const change = captureChange(before, { folders: [folder], pages: [vault, mira, made] }, meta)!;
    expect(change.before).toEqual([]);
    expect(change.createdPageIds).toEqual(['pit']);
    expect(change.createdFolderIds).toEqual(['f']);
  });

  it('is null when nothing changed', () => {
    expect(captureChange(before, before, meta)).toBeNull();
  });
});

describe('undoing a change', () => {
  const edited = { ...mira, title: 'Mira Thorne' };
  const made = page('pit', 'Gladiators', { folderId: 'f' });
  const folder: Folder = { id: 'f', name: 'Places', parentId: null };
  const after = { folders: [folder], pages: [vault, edited, made] };
  const change = captureChange(before, after, meta)!;

  it('puts back changed pages, removes made pages and empty made folders, and leaves the rest', () => {
    const userEdit = { ...vault, title: 'Vaultrock' };
    const result = undoChange({ ...after, pages: [userEdit, edited, made] }, change, newId);
    expect(result.folders).toEqual([]);
    expect(result.pages.map((p) => [p.id, p.title])).toEqual([
      ['vault', 'Vaultrock'],
      ['mira', 'mira'],
    ]);
  });

  it('gives restored boxes new ids, so open editors reload them', () => {
    const restored = undoChange(after, change, newId).pages.find((p) => p.id === 'mira')!;
    expect(restored.boxes[0].id).not.toBe(mira.boxes[0].id);
    expect(restored.boxes[0].content).toEqual(mira.boxes[0].content);
  });

  it('keeps a made folder the user has since put things in, and moves pages put under a made page to the top', () => {
    const mine = page('mine', 'Mine', { folderId: 'f' });
    const under = page('under', 'Under', { parentPageId: 'pit' });
    const result = undoChange({ ...after, pages: [...after.pages, mine, under] }, change, newId);
    expect(result.folders).toEqual([folder]);
    expect(result.pages.find((p) => p.id === 'under')).toMatchObject({ folderId: null, parentPageId: undefined });
  });

  it('brings back a changed page that was deleted since', () => {
    const result = undoChange({ ...after, pages: [vault, made] }, change, newId);
    expect(result.pages.map((p) => p.id)).toContain('mira');
  });

  it('tells which touched pages were edited since', () => {
    expect(changedSince(after, change)).toEqual([]);
    const later = { ...edited, title: 'Mira the Bold' };
    expect(changedSince({ ...after, pages: [vault, later, made] }, change)).toEqual([edited]);
  });
});

describe('the list of changes', () => {
  it('keeps the newest', () => {
    let list: AiChange[] = [];
    for (let i = 0; i < AI_CHANGES_LIMIT + 5; i++) list = addChange(list, { ...captureChange(before, { folders: [], pages: [vault] }, meta)!, id: `c${i}` });
    expect(list).toHaveLength(AI_CHANGES_LIMIT);
    expect(list[list.length - 1].id).toBe(`c${AI_CHANGES_LIMIT + 4}`);
  });
});
