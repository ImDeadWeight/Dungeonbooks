/**
 * @file Tool arguments about images and pins: which image on a page (by its
 * number in read_page), which pin on it (by its number in view_image), and
 * spots as x and y fractions of the image (0,0 top left; 1,1 bottom right).
 */
import { clampFraction } from '../../lorekeeper/domain/images';
import type { ImageBox, MapPin, Page } from '../../lorekeeper/domain/notebook';
import { findPage } from './findPage';
import { ToolError } from './types';

export const PAGE_ARG = { type: 'string', description: 'The page the image is on: its title, an alias, or its id.' };
export const IMAGE_ARG = { type: 'integer', minimum: 1, description: 'The image number from read_page; may be left out when the page has one image.' };
export const PIN_ARG = { type: 'integer', minimum: 1, description: 'The pin number from view_image.' };
export const SPOT_ARGS = {
  x: { type: 'number', minimum: 0, maximum: 1, description: 'Across the image: 0 is the left edge, 1 the right (view_image draws grid lines every 0.1).' },
  y: { type: 'number', minimum: 0, maximum: 1, description: 'Down the image: 0 is the top edge, 1 the bottom.' },
};

/** The image an argument picks on a page. */
export function imageArg(page: Page, value: unknown): ImageBox {
  const images = page.images ?? [];
  if (!images.length) throw new ToolError(`"${page.title}" has no images.`);
  if (value === undefined && images.length === 1) return images[0];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > images.length) {
    throw new ToolError(`image must be an image number from 1 to ${images.length} (read_page lists them).`);
  }
  return images[value - 1];
}

/** The pin an argument picks on an image. */
export function pinArg(image: ImageBox, value: unknown): MapPin {
  const pins = image.pins ?? [];
  if (!pins.length) throw new ToolError('That image has no pins yet.');
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > pins.length) {
    throw new ToolError(`pin must be a pin number from 1 to ${pins.length} (view_image lists them).`);
  }
  return pins[value - 1];
}

/** A spot from x and y arguments. */
export function spotArg(args: Record<string, unknown>): { x: number; y: number } {
  const { x, y } = args;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new ToolError('x and y must be numbers from 0 to 1.');
  }
  return { x: clampFraction(x), y: clampFraction(y) };
}

export const spot = (p: { x: number; y: number }) => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
export const imageName = (page: Page, image: ImageBox) => (image.caption ? `the map "${image.caption}" on "${page.title}"` : `the image on "${page.title}"`);

/** The page and image named by the arguments, read fresh from the notes. */
export function target(args: Record<string, unknown>) {
  const page = findPage(args.page);
  return { page, image: imageArg(page, args.image) };
}

/** The optional caption argument. */
export const captionArg = (value: unknown) => (typeof value === 'string' ? value : undefined);
