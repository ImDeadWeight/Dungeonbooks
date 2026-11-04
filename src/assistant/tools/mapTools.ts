/**
 * @file What AI apps can do with images and maps on pages: add one (from a
 * file, a web address or base64), look at one (as a picture with a grid and
 * numbered pins), pin pages on it, move and remove pins, and caption it. Images are numbered per page as read_page lists
 * them; pins per image as view_image lists them. Spots are x and y
 * fractions of the image (0,0 top left; 1,1 bottom right).
 */
import { belowEverything, clampFraction } from '../../lorekeeper/domain/images';
import type { ImageBox, MapPin, Page } from '../../lorekeeper/domain/notebook';
import { addPin, movePin, placeImage, removePin, updateImage } from '../../lorekeeper/state/imageActions';
import { storeImage } from '../../lorekeeper/state/imageFiles';
import { useNotebook } from '../../lorekeeper/state/notebookStore';
import { findPage } from './findPage';
import { loadImageArg } from './imageSource';
import { mapPicture } from './mapPicture';
import { ToolError, type Tool } from './types';

const PAGE_ARG = { type: 'string', description: 'The page the image is on: its title, an alias, or its id.' };
const IMAGE_ARG = { type: 'integer', minimum: 1, description: 'The image number from read_page; may be left out when the page has one image.' };
const PIN_ARG = { type: 'integer', minimum: 1, description: 'The pin number from view_image.' };
const SPOT_ARGS = {
  x: { type: 'number', minimum: 0, maximum: 1, description: 'Across the image: 0 is the left edge, 1 the right (view_image draws grid lines every 0.1).' },
  y: { type: 'number', minimum: 0, maximum: 1, description: 'Down the image: 0 is the top edge, 1 the bottom.' },
};

/** The image an argument picks on a page. */
function imageArg(page: Page, value: unknown): ImageBox {
  const images = page.images ?? [];
  if (!images.length) throw new ToolError(`"${page.title}" has no images.`);
  if (value === undefined && images.length === 1) return images[0];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > images.length) {
    throw new ToolError(`image must be an image number from 1 to ${images.length} (read_page lists them).`);
  }
  return images[value - 1];
}

/** The pin an argument picks on an image. */
function pinArg(image: ImageBox, value: unknown): MapPin {
  const pins = image.pins ?? [];
  if (!pins.length) throw new ToolError('That image has no pins yet.');
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > pins.length) {
    throw new ToolError(`pin must be a pin number from 1 to ${pins.length} (view_image lists them).`);
  }
  return pins[value - 1];
}

/** A spot from x and y arguments. */
function spotArg(args: Record<string, unknown>): { x: number; y: number } {
  const { x, y } = args;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new ToolError('x and y must be numbers from 0 to 1.');
  }
  return { x: clampFraction(x), y: clampFraction(y) };
}

const spot = (p: { x: number; y: number }) => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
const imageName = (page: Page, image: ImageBox) => (image.caption ? `the map "${image.caption}" on "${page.title}"` : `the image on "${page.title}"`);

/** The page and image named by the arguments, read fresh from the notes. */
function target(args: Record<string, unknown>) {
  const page = findPage(args.page);
  return { page, image: imageArg(page, args.image) };
}

export const MAP_TOOLS: Tool[] = [
  {
    name: 'add_image',
    title: 'Add an image to a page',
    description:
      'Puts a picture on a page, below what is there, from exactly one of: path (a PNG, JPEG, WebP or GIF file on this computer, by its full path), url (a web address of an image), or data (the image as base64). Up to 25 MB; very large pictures are scaled down. It can then be used as a map (view_image, add_pin).',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'string', description: 'The page to put it on: its title, an alias, or its id.' },
        path: { type: 'string', description: 'Full path of an image file on this computer.' },
        url: { type: 'string', description: 'Web address of an image.' },
        data: { type: 'string', description: 'The image as base64.' },
        caption: { type: 'string', description: 'Shown under it (and the map’s name).' },
      },
      required: ['page'],
    },
    async prepare(args) {
      // The page first, so a wrong name fails before anything is downloaded or stored.
      findPage(args.page);
      return storeImage(await loadImageArg(args));
    },
    run(args, imageId) {
      const page = findPage(args.page);
      const at = belowEverything(page);
      placeImage(page.id, imageId as string, at.x, at.y, typeof args.caption === 'string' ? args.caption : undefined);
      const number = (page.images?.length ?? 0) + 1;
      return `Added image ${number} to "${page.title}".`;
    },
  },
  {
    name: 'view_image',
    title: 'Look at an image or map',
    description:
      'Shows an image on a page as a picture, with grid lines every 0.1 labelled along the top and left (so spots can be named as x and y from 0 to 1), and its pins as numbered red markers. Lists the pins with the pages they point at. Use it before placing or moving pins.',
    inputSchema: {
      type: 'object',
      properties: { page: PAGE_ARG, image: IMAGE_ARG, grid: { type: 'boolean', description: 'Draw the grid (default true).' } },
      required: ['page'],
    },
    readOnly: true,
    async run(args) {
      const { page, image } = target(args);
      const { picture, width, height } = await mapPicture(image, args.grid !== false);
      const { pages } = useNotebook.getState();
      const pins = (image.pins ?? []).map((pin, i) => `${i + 1}. ${pages.find((p) => p.id === pin.pageId)?.title ?? '(deleted page)'} at ${spot(pin)}`);
      const text = [
        `Showing ${imageName(page, image)} (${width}×${height} px).`,
        'Spots are (x, y): x from 0 (left) to 1 (right), y from 0 (top) to 1 (bottom).',
        pins.length ? `Pins:\n${pins.join('\n')}` : 'No pins yet.',
      ].join('\n');
      return { text, image: picture };
    },
  },
  {
    name: 'add_pin',
    title: 'Pin a page on a map',
    description: 'Puts a pin on an image at a spot, pointing at a page (a place on a world map, a room on a dungeon map). The image becomes a map if it wasn’t one. Look with view_image first to find the spot.',
    inputSchema: {
      type: 'object',
      properties: { page: PAGE_ARG, image: IMAGE_ARG, ...SPOT_ARGS, pin_page: { type: 'string', description: 'The page the pin points at (title, alias or id).' } },
      required: ['page', 'x', 'y', 'pin_page'],
    },
    run(args) {
      const { page, image } = target(args);
      const pinned = findPage(args.pin_page);
      const at = spotArg(args);
      addPin(page.id, image.id, { ...at, pageId: pinned.id });
      return `Pinned "${pinned.title}" on ${imageName(page, image)} at ${spot(at)} (pin ${(image.pins?.length ?? 0) + 1}).`;
    },
  },
  {
    name: 'move_pin',
    title: 'Move a pin',
    description: 'Moves a pin on a map to another spot.',
    inputSchema: { type: 'object', properties: { page: PAGE_ARG, image: IMAGE_ARG, pin: PIN_ARG, ...SPOT_ARGS }, required: ['page', 'pin', 'x', 'y'] },
    run(args) {
      const { page, image } = target(args);
      const pin = pinArg(image, args.pin);
      const at = spotArg(args);
      movePin(page.id, image.id, pin.id, at.x, at.y);
      return `Moved pin ${String(args.pin)} on ${imageName(page, image)} to ${spot(at)}.`;
    },
  },
  {
    name: 'remove_pin',
    title: 'Remove a pin',
    description: 'Takes a pin off a map (the page it pointed at stays). Pins after it move up one number.',
    inputSchema: { type: 'object', properties: { page: PAGE_ARG, image: IMAGE_ARG, pin: PIN_ARG }, required: ['page', 'pin'] },
    run(args) {
      const { page, image } = target(args);
      const pin = pinArg(image, args.pin);
      removePin(page.id, image.id, pin.id);
      return `Removed pin ${String(args.pin)} from ${imageName(page, image)}.`;
    },
  },
  {
    name: 'set_caption',
    title: 'Caption an image',
    description: 'Sets the caption shown under an image (also the map’s name). An empty caption removes it.',
    inputSchema: { type: 'object', properties: { page: PAGE_ARG, image: IMAGE_ARG, caption: { type: 'string' } }, required: ['page', 'caption'] },
    run(args) {
      const { page, image } = target(args);
      if (typeof args.caption !== 'string') throw new ToolError('caption must be text.');
      const caption = args.caption.trim();
      updateImage(page.id, image.id, { caption });
      return caption ? `Captioned the image on "${page.title}" "${caption}".` : `Removed the caption of the image on "${page.title}".`;
    },
  },
];
