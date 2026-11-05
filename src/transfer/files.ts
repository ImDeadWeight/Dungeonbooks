/**
 * @file Files the user picks for exports and imports: native Save and Open
 * dialogs under Tauri, a download and a file picker in a plain browser.
 */
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { isTauri } from '../platform';

/** Every export is JSON. */
const FILTERS = [{ name: 'Dungeon Books file', extensions: ['json'] }];

/** A file the user opened. */
export interface PickedFile {
  /** File name without folder or extensions, e.g. "Veilstrand" for "Veilstrand.dungeonbooks.json". */
  baseName: string;
  text: string;
}

/** "C:\maps\veil.dungeonbooks.json" → "veil". */
function baseName(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path;
  return name.replace(/(\.(dungeonbooks|encounters))?\.json$/i, '') || name;
}

/** Asks where to save `text`, suggesting `fileName`. Resolves false if the user cancels. */
export async function saveFile(fileName: string, text: string): Promise<boolean> {
  if (isTauri()) {
    // The dialog grants the app access to the path the user picks.
    const path = await save({ defaultPath: fileName, filters: FILTERS });
    if (!path) return false;
    await writeTextFile(path, text);
    return true;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Asks the user to pick a file and reads it. Resolves null if they cancel. */
export async function openFile(): Promise<PickedFile | null> {
  if (isTauri()) {
    const path = await open({ multiple: false, directory: false, filters: FILTERS });
    if (typeof path !== 'string') return null;
    return { baseName: baseName(path), text: await readTextFile(path) };
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      resolve(file ? { baseName: baseName(file.name), text: await file.text() } : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
