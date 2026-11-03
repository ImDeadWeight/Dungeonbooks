/**
 * @file Document storage for the desktop/mobile app: JSON files in one
 * folder under the app's AppData folder, written atomically via Tauri's fs
 * plugin.
 */
import { BaseDirectory, exists, mkdir, readTextFile, remove, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import type { DocumentStore } from './types';

/** fs plugin options: paths are relative to AppData. */
const opts = { baseDir: BaseDirectory.AppData };

/**
 * JSON files in `data/<folder>` under the app's AppData folder
 * (%APPDATA%\com.dungeonbooks.app\data\<folder> on Windows).
 */
export function tauriStore(folder: string): DocumentStore {
  const dir = `data/${folder}`;
  /** Relative path of a document's file, e.g. "data/encounters/library.json". */
  const path = (name: string) => `${dir}/${name}.json`;
  /** Creates the folder on first use. */
  const ensureDir = async () => {
    if (!(await exists(dir, opts))) await mkdir(dir, { ...opts, recursive: true });
  };

  return {
    async read(name) {
      if (!(await exists(path(name), opts))) return null;
      return readTextFile(path(name), opts);
    },
    async write(name, text) {
      await ensureDir();
      // Write then rename so a crash mid-write never leaves a half-written file.
      const tmp = `${path(name)}.tmp`;
      await writeTextFile(tmp, text, opts);
      await rename(tmp, path(name), { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
    },
    async backup(name, text) {
      await ensureDir();
      await writeTextFile(`${dir}/${name}.corrupt-${Date.now()}.json`, text, opts);
    },
    async remove(name) {
      if (await exists(path(name), opts)) await remove(path(name), opts);
    },
  };
}
