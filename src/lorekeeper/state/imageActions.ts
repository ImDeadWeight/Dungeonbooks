/**
 * @file Edits to the images on pages and the pins on maps (kept beside the
 * notebook store, which holds the pages).
 */
import { newId, type Id } from '../domain/ids';
import { withImages, withPins } from '../domain/images';
import type { ImageBox, MapPin, Page } from '../domain/notebook';
import { useNotebook } from './notebookStore';
import { storeImage } from './imageFiles';
import { useUi } from './uiStore';

/** Width of a newly placed image (px). */
const NEW_IMAGE_WIDTH = 480;

function changePage(pageId: Id, change: (page: Page) => Page) {
  useNotebook.setState((s) => ({ pages: s.pages.map((p) => (p.id === pageId ? change(p) : p)) }));
}

function changeImage(pageId: Id, boxId: Id, change: (image: ImageBox) => ImageBox) {
  changePage(pageId, (p) => withImages(p, (images) => images.map((i) => (i.id === boxId ? change(i) : i))));
}

/** Stores pictures and places them on a page from (x, y), each below the last; reports what fails. */
export async function addImages(pageId: Id, files: Blob[], x: number, y: number): Promise<void> {
  let top = y;
  for (const file of files) {
    try {
      const imageId = await storeImage(file);
      const box: ImageBox = { id: newId(), x, y: top, width: NEW_IMAGE_WIDTH, imageId };
      changePage(pageId, (p) => withImages(p, (images) => [...images, box]));
      top += 40;
    } catch (err) {
      useUi.getState().notifyError(`Could not add the image: ${(err as Error).message}`);
    }
  }
}

export function updateImage(pageId: Id, boxId: Id, patch: Partial<Pick<ImageBox, 'x' | 'y' | 'width' | 'caption'>>) {
  changeImage(pageId, boxId, (i) => {
    const next = { ...i, ...patch };
    if (patch.caption !== undefined && !patch.caption.trim()) delete next.caption;
    return next;
  });
}

export function deleteImage(pageId: Id, boxId: Id) {
  changePage(pageId, (p) => withImages(p, (images) => images.filter((i) => i.id !== boxId)));
}

/** Adds a pin to a map; returns its id. */
export function addPin(pageId: Id, boxId: Id, pin: Omit<MapPin, 'id'>): Id {
  const id = newId();
  changeImage(pageId, boxId, (i) => withPins(i, (pins) => [...pins, { ...pin, id }]));
  return id;
}

export function movePin(pageId: Id, boxId: Id, pinId: Id, x: number, y: number) {
  changeImage(pageId, boxId, (i) => withPins(i, (pins) => pins.map((p) => (p.id === pinId ? { ...p, x, y } : p))));
}

export function removePin(pageId: Id, boxId: Id, pinId: Id) {
  changeImage(pageId, boxId, (i) => withPins(i, (pins) => pins.filter((p) => p.id !== pinId)));
}
