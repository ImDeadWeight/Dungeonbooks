/**
 * @file Images as files for the desktop and phone app, under
 * data/lorekeeper/images/<campaign id>/ in the app's AppData folder.
 */
import { BaseDirectory, exists, mkdir, readDir, readFile, remove, rename, writeFile } from '@tauri-apps/plugin-fs';
import { LOREKEEPER_FOLDER } from './documents';
import type { ImageStore } from './images';

const opts = { baseDir: BaseDirectory.AppData };
const both = { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData };

export function tauriImages(campaignId: string): ImageStore {
  const dir = `data/${LOREKEEPER_FOLDER}/images/${campaignId}`;
  const path = (imageId: string) => `${dir}/${imageId}`;
  return {
    async put(imageId, bytes) {
      if (await exists(path(imageId), opts)) return;
      if (!(await exists(dir, opts))) await mkdir(dir, { ...opts, recursive: true });
      // Write then rename, so a crash never leaves half an image under its id.
      await writeFile(`${path(imageId)}.tmp`, bytes, opts);
      await rename(`${path(imageId)}.tmp`, path(imageId), both);
    },
    async get(imageId) {
      return (await exists(path(imageId), opts)) ? readFile(path(imageId), opts) : null;
    },
    async list() {
      if (!(await exists(dir, opts))) return [];
      return (await readDir(dir, opts)).filter((e) => e.isFile && !e.name.endsWith('.tmp')).map((e) => e.name);
    },
    async remove(imageId) {
      if (await exists(path(imageId), opts)) await remove(path(imageId), opts);
    },
    async removeAll() {
      if (await exists(dir, opts)) await remove(dir, { ...opts, recursive: true });
    },
  };
}
