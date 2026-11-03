/**
 * @file Saving and opening user-chosen files for export/import: native
 * Save/Open dialogs under Tauri, download/upload in a plain browser.
 */
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { isTauri } from '../../platform';

/** File type filter shown in the native dialogs. */
const FILTERS = [{ name: 'Encounters export', extensions: ['json'] }];

/**
 * Saves text to a user-chosen file. Returns false if the user cancelled.
 * Tauri: native Save dialog (the chosen path is added to the fs scope).
 * Browser: a regular download.
 */
export async function saveTextFile(suggestedName: string, text: string): Promise<boolean> {
  if (isTauri()) {
    const path = await save({ defaultPath: suggestedName, filters: FILTERS });
    if (!path) return false;
    await writeTextFile(path, text);
    return true;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Lets the user pick a file to read. Returns null if they cancelled. */
export async function openTextFile(): Promise<string | null> {
  if (isTauri()) {
    const path = await open({ multiple: false, directory: false, filters: FILTERS });
    if (!path || Array.isArray(path)) return null;
    return readTextFile(path);
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
