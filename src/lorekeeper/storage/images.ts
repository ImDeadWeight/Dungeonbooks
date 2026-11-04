/**
 * @file Where images live: one folder (or browser database) per campaign,
 * one file per image, named by its id (content hash + extension), so the
 * notes only hold ids. Files under data/lorekeeper/images/<campaign id>/
 * under Tauri; IndexedDB in a plain browser.
 */
import { isTauri } from '../../platform';
import { browserImages } from './imageDb';
import { tauriImages } from './imageFiles';

/** One campaign's stored images. */
export interface ImageStore {
  /** Stores an image under its id (nothing happens if it is already there). */
  put(imageId: string, bytes: Uint8Array): Promise<void>;
  /** The image's bytes, or null when it isn't stored. */
  get(imageId: string): Promise<Uint8Array | null>;
  /** Every stored image's id. */
  list(): Promise<string[]>;
  remove(imageId: string): Promise<void>;
  /** Removes every image (the campaign was deleted). */
  removeAll(): Promise<void>;
}

/** A campaign's images. */
export function imageStore(campaignId: string): ImageStore {
  return isTauri() ? tauriImages(campaignId) : browserImages(campaignId);
}
