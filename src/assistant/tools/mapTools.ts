/**
 * @file What AI apps can do with maps on pages: look at an image (as a
 * picture with a grid and numbered pins), pin pages on it, move and remove
 * pins, and caption it. Adding pictures is imageTools.ts.
 */
import { addPin, movePin, removePin, updateImage } from '../../lorekeeper/state/imageActions';
import { useNotebook } from '../../lorekeeper/state/notebookStore';
import { findPage } from './findPage';
import { IMAGE_ARG, imageName, PAGE_ARG, PIN_ARG, pinArg, spot, SPOT_ARGS, spotArg, target } from './imageArgs';
import { mapPicture } from './mapPicture';
import { ToolError, type Tool } from './types';

export const MAP_TOOLS: Tool[] = [
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
