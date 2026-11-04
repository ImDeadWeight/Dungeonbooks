import { beforeEach, describe, expect, it } from 'vitest';
import type { Page } from '../../lorekeeper/domain/notebook';
import { useNotebook } from '../../lorekeeper/state/notebookStore';
import { toolNamed } from '.';
import { outputText } from './types';

const run = async (name: string, args: object) => outputText(await toolNamed(name)!.run(args as Record<string, unknown>));
const atlas = () => useNotebook.getState().pages.find((p) => p.id === 'atlas')!;
const image = () => atlas().images![0];

const page = (id: string, title: string, extra: Partial<Page> = {}): Page => ({ id, title, folderId: null, boxes: [], ...extra });

beforeEach(() => {
  useNotebook.getState().replaceAll({
    folders: [],
    pages: [
      page('atlas', 'Atlas', { images: [{ id: 'img', x: 0, y: 0, width: 400, imageId: `${'a'.repeat(64)}.png` }] }),
      page('vault', 'Vaultrock'),
      page('mines', 'The Mines'),
      page('blank', 'Blank'),
    ],
  });
});

describe('map tools', () => {
  it('pins pages on a map, moves and removes pins, and read_page lists them', async () => {
    expect(await run('add_pin', { page: 'Atlas', x: 0.4, y: 1.7, pin_page: 'vaultrock' })).toBe('Pinned "Vaultrock" on the image on "Atlas" at (0.40, 1.00) (pin 1).');
    await run('add_pin', { page: 'Atlas', image: 1, x: 0.1, y: 0.2, pin_page: 'The Mines' });
    expect(image().pins!.map((p) => [p.pageId, p.x, p.y])).toEqual([
      ['vault', 0.4, 1],
      ['mines', 0.1, 0.2],
    ]);

    await run('move_pin', { page: 'Atlas', pin: 2, x: 0.5, y: 0.5 });
    expect(image().pins![1]).toMatchObject({ x: 0.5, y: 0.5 });
    await run('remove_pin', { page: 'Atlas', pin: 1 });
    expect(image().pins!.map((p) => p.pageId)).toEqual(['mines']);

    await run('set_caption', { page: 'Atlas', caption: 'The Veil' });
    expect(await run('read_page', { page: 'Atlas' })).toContain('Image 1: "The Veil", a map with pins for The Mines');
  });

  it('explains mistakes', async () => {
    await expect(run('add_pin', { page: 'Blank', x: 0, y: 0, pin_page: 'Atlas' })).rejects.toThrow('"Blank" has no images.');
    await expect(run('move_pin', { page: 'Atlas', pin: 1, x: 0, y: 0 })).rejects.toThrow('no pins');
    await expect(run('add_pin', { page: 'Atlas', x: 'left', y: 0, pin_page: 'Atlas' })).rejects.toThrow('x and y must be numbers');
    await expect(run('add_pin', { page: 'Atlas', image: 2, x: 0, y: 0, pin_page: 'Atlas' })).rejects.toThrow('from 1 to 1');
  });
});
