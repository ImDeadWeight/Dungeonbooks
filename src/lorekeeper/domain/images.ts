/**
 * @file Images on pages and the pins on maps: changing a page's images,
 * which images the notes use, and which maps point at a page.
 */
import type { Id } from './ids';
import type { ImageBox, MapPin, Page } from './notebook';

/** A page with its images changed (the field is left off when none remain). */
export function withImages(page: Page, change: (images: ImageBox[]) => ImageBox[]): Page {
  const { images: _old, ...rest } = page;
  const images = change(page.images ?? []);
  return images.length ? { ...rest, images } : rest;
}

/** An image with its pins changed (the field is left off when none remain). */
export function withPins(image: ImageBox, change: (pins: MapPin[]) => MapPin[]): ImageBox {
  const { pins: _old, ...rest } = image;
  const pins = change(image.pins ?? []);
  return pins.length ? { ...rest, pins } : rest;
}

/** Every stored image the pages use. */
export function imageIdsOf(pages: Page[]): Set<string> {
  return new Set(pages.flatMap((p) => (p.images ?? []).map((i) => i.imageId)));
}

/** A spot as a fraction of the image, kept on the image. */
export const clampFraction = (n: number) => Math.min(1, Math.max(0, n));

/** The maps (images with pins) on a page. */
export const mapsOf = (page: Page): ImageBox[] => (page.images ?? []).filter((i) => i.pins?.length);

/** Pins pointing at a page, with the page and image they're on. */
export interface PinRef {
  page: Page;
  image: ImageBox;
  pin: MapPin;
}

/** Every pin, on every page's maps. */
export function allPins(pages: Page[]): PinRef[] {
  return pages.flatMap((page) => (page.images ?? []).flatMap((image) => (image.pins ?? []).map((pin) => ({ page, image, pin }))));
}

/** File extension for an image type ("image/png" → "png"); null for types the app doesn't store. */
export function imageExtension(mime: string): string | null {
  const known: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
  return known[mime] ?? null;
}

/** The image type for a stored image's id ("….png" → "image/png"). */
export function imageMime(imageId: string): string {
  const ext = imageId.split('.').pop();
  return { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[ext ?? ''] ?? 'application/octet-stream';
}

/** A stored image id: the content's hash and its extension, so the same picture is stored once. */
export const imageIdFor = (hashHex: string, ext: string) => `${hashHex}.${ext}`;

/** True for a well-formed stored image id (checked on import, since ids become file names). */
export const isImageId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}\.(png|jpg|webp|gif)$/.test(v);

/** Pins pointing at `pageId` from any page's maps. */
export function pinsTo(pages: Page[], pageId: Id): PinRef[] {
  return allPins(pages).filter((r) => r.pin.pageId === pageId);
}
