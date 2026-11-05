/**
 * @file What AI apps can do to put pictures on pages: add one that exists
 * (a file, a web address, base64), or draw one as SVG (a map's layout, a
 * diagram), new or in place of an image already there. Pictures are stored
 * in prepare, then placed at once, so undo records the change.
 */
import { belowEverything } from '../../lorekeeper/domain/images';
import { placeImage, setImageFile, updateImage } from '../../lorekeeper/state/imageActions';
import { storeImage } from '../../lorekeeper/state/imageFiles';
import { findPage } from './findPage';
import { captionArg, IMAGE_ARG, imageArg } from './imageArgs';
import { loadImageArg } from './imageSource';
import { svgToPng } from './svgPicture';
import type { Tool } from './types';

const NEW_PAGE_ARG = { type: 'string', description: 'The page to put it on: its title, an alias, or its id.' };
const CAPTION_ARG = { type: 'string', description: 'Shown under it (and the map’s name).' };

/** Puts a stored picture on a page below what is there; says which image number it got. */
function placeBelow(args: Record<string, unknown>, imageId: string): string {
  const page = findPage(args.page);
  const at = belowEverything(page);
  placeImage(page.id, imageId, at.x, at.y, captionArg(args.caption));
  return `Added image ${(page.images?.length ?? 0) + 1} to "${page.title}".`;
}

export const IMAGE_TOOLS: Tool[] = [
  {
    name: 'add_image',
    title: 'Add an image to a page',
    description:
      'Puts a picture on a page, below what is there, from exactly one of: path (a PNG, JPEG, WebP or GIF file on this computer, by its full path), url (a web address of an image), or data (the image as base64). Up to 25 MB; very large pictures are scaled down. It can then be used as a map (view_image, add_pin).',
    inputSchema: {
      type: 'object',
      properties: {
        page: NEW_PAGE_ARG,
        path: { type: 'string', description: 'Full path of an image file on this computer.' },
        url: { type: 'string', description: 'Web address of an image.' },
        data: { type: 'string', description: 'The image as base64.' },
        caption: CAPTION_ARG,
      },
      required: ['page'],
    },
    async prepare(args) {
      // The page first, so a wrong name fails before anything is downloaded or stored.
      findPage(args.page);
      return storeImage(await loadImageArg(args));
    },
    run: (args, imageId) => placeBelow(args, imageId as string),
  },
  {
    name: 'draw_image',
    title: 'Draw an image (SVG)',
    description:
      'Draws a picture from SVG you write, such as a map’s layout (land, coast, rivers, roads, regions, labels) or a diagram, and puts it on a page; or, with image, redraws an image already there, keeping its caption and pins (pins are fractions of the picture, so keep the same aspect ratio for them to stay in place). Give the <svg> a viewBox (e.g. "0 0 1600 1000"); it is drawn 2048 px on its long side. Plain shapes, paths, gradients and <text> work; scripts, links to other files and web fonts don’t. Check the result with view_image, then pin pages on it.',
    inputSchema: {
      type: 'object',
      properties: {
        page: NEW_PAGE_ARG,
        svg: { type: 'string', description: 'The drawing: one <svg> element with a viewBox.' },
        image: { ...IMAGE_ARG, description: 'To redraw an existing image instead of adding one: its number from read_page.' },
        caption: CAPTION_ARG,
      },
      required: ['page', 'svg'],
    },
    async prepare(args) {
      const page = findPage(args.page);
      if (args.image !== undefined) imageArg(page, args.image);
      return storeImage(await svgToPng(args.svg));
    },
    run(args, imageId) {
      if (args.image === undefined) return placeBelow(args, imageId as string);
      const page = findPage(args.page);
      const image = imageArg(page, args.image);
      setImageFile(page.id, image.id, imageId as string);
      const caption = captionArg(args.caption);
      if (caption !== undefined) updateImage(page.id, image.id, { caption });
      return `Redrew image ${String(args.image)} on "${page.title}"${image.pins?.length ? `; ${image.pins.length === 1 ? 'its pin stays' : `its ${image.pins.length} pins stay`} where ${image.pins.length === 1 ? 'it was' : 'they were'}` : ''}.`;
    },
  },
];
