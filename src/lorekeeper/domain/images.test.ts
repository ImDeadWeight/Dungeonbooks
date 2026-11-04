import { describe, expect, it } from 'vitest';
import { fromBase64, readImageBoxes, readImageData, toBase64 } from './imageExport';
import { imageIdsOf, isImageId, withImages, withPins } from './images';
import type { ImageBox, Page } from './notebook';

const id = `${'a'.repeat(64)}.png`;
const image: ImageBox = { id: 'i', x: 10, y: 20, width: 300, imageId: id };
const page: Page = { id: 'p', title: 'Atlas', folderId: null, boxes: [] };

describe('images on pages', () => {
  it('adds and removes images, leaving the field off when none remain', () => {
    const withOne = withImages(page, (images) => [...images, image]);
    expect(withOne.images).toEqual([image]);
    expect('images' in withImages(withOne, () => [])).toBe(false);
  });

  it('adds and removes pins the same way', () => {
    const pinned = withPins(image, (pins) => [...pins, { id: 'pin', x: 0.5, y: 0.5, pageId: 'vault' }]);
    expect(pinned.pins).toHaveLength(1);
    expect('pins' in withPins(pinned, () => [])).toBe(false);
  });

  it('lists the images the pages use', () => {
    expect([...imageIdsOf([{ ...page, images: [image] }, page])]).toEqual([id]);
  });

  it('only takes hash-named image ids, since they become file names', () => {
    expect(isImageId(id)).toBe(true);
    expect(isImageId('../../evil.png')).toBe(false);
    expect(isImageId(`${'a'.repeat(64)}.exe`)).toBe(false);
  });
});

describe('images in notebook files', () => {
  it('reads image boxes, clamping pins onto the image and dropping damaged boxes', () => {
    const read = readImageBoxes([
      { ...image, pins: [{ id: 'pin', x: 1.5, y: -1, pageId: 'vault' }, { id: 'bad' }] },
      { id: 'no-image' },
      { id: 'bad-id', imageId: '../x.png' },
    ]);
    expect(read).toEqual([{ ...image, pins: [{ id: 'pin', x: 1, y: 0, pageId: 'vault' }] }]);
  });

  it('keeps only well-named pictures', () => {
    expect(readImageData({ [id]: 'AAAA', 'evil.png': 'AAAA', [`${'b'.repeat(64)}.jpg`]: 42 })).toEqual({ [id]: 'AAAA' });
  });

  it('round-trips bytes through base64, also large ones', () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => i % 256);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});

describe('telling image types by their bytes', () => {
  it('knows PNG, JPEG, GIF and WebP, and nothing else', async () => {
    const { sniffImageType } = await import('./images');
    const bytes = (...b: number[]) => Uint8Array.from(b);
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffImageType(new TextEncoder().encode('GIF89a'))).toBe('image/gif');
    expect(sniffImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImageType(new TextEncoder().encode('<svg>'))).toBeNull();
  });
});
