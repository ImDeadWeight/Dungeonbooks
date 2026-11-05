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

describe('adding images', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('places a stored image below what is on the page, with its caption', async () => {
    const tool = toolNamed('add_image')!;
    const imageId = `${'b'.repeat(64)}.png`;
    expect(await tool.run({ page: 'Atlas', caption: 'Old map' }, imageId)).toBe('Added image 2 to "Atlas".');
    expect(atlas().images![1]).toMatchObject({ imageId, caption: 'Old map', x: 40 });
    expect(atlas().images![1].y).toBeGreaterThan(atlas().images![0].y);
  });

  it('takes exactly one source, and only real images', async () => {
    const { loadImageArg } = await import('./imageSource');
    await expect(loadImageArg({})).rejects.toThrow('exactly one of path');
    await expect(loadImageArg({ url: 'ftp://x', data: png })).rejects.toThrow('exactly one of path');
    await expect(loadImageArg({ url: 'file:///C:/x.png' })).rejects.toThrow('http:// or https://');
    await expect(loadImageArg({ data: btoa('not an image') })).rejects.toThrow('isn\u2019t a PNG');
    expect((await loadImageArg({ data: `data:image/png;base64,${png}` })).type).toBe('image/png');
  });

  it('checks the page before fetching anything', async () => {
    await expect(toolNamed('add_image')!.prepare!({ page: 'Nowhere', data: png })).rejects.toThrow('No page is called "Nowhere"');
  });
});

describe('drawing images', () => {
  it('redraws an image in place, keeping its pins and setting a caption', async () => {
    await run('add_pin', { page: 'Atlas', x: 0.3, y: 0.6, pin_page: 'Vaultrock' });
    const newId = `${'c'.repeat(64)}.png`;
    const text = await toolNamed('draw_image')!.run({ page: 'Atlas', image: 1, svg: '<svg/>', caption: 'Drawn' }, newId);
    expect(text).toBe('Redrew image 1 on "Atlas"; its pin stays where it was.');
    expect(image()).toMatchObject({ imageId: newId, caption: 'Drawn', pins: [{ pageId: 'vault', x: 0.3, y: 0.6 }] });
  });

  it('adds a new drawing below what is there', async () => {
    expect(await toolNamed('draw_image')!.run({ page: 'Atlas', svg: '<svg/>' }, `${'d'.repeat(64)}.png`)).toBe('Added image 2 to "Atlas".');
  });

  it('checks the page and image before drawing', async () => {
    const draw = toolNamed('draw_image')!;
    await expect(draw.prepare!({ page: 'Nowhere', svg: '<svg viewBox="0 0 1 1"/>' })).rejects.toThrow('No page is called');
    await expect(draw.prepare!({ page: 'Atlas', image: 3, svg: '<svg viewBox="0 0 1 1"/>' })).rejects.toThrow('from 1 to 1');
  });
});
