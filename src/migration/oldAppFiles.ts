/**
 * @file Reading the separate apps' saved files (Windows:
 * %APPDATA%\com.encounters.app\data and %APPDATA%\com.lorekeeper.app\data).
 * Read only: nothing here writes to the old apps' folders, so they keep
 * working on their own copies.
 */
import { BaseDirectory, exists, readTextFile } from '@tauri-apps/plugin-fs';

/** Each old app's AppData folder name (its identifier). */
export const OLD_APPS = { encounters: 'com.encounters.app', lorekeeper: 'com.lorekeeper.app' } as const;

/** fs plugin options: paths are relative to the user's data folder (%APPDATA% on Windows). */
const opts = { baseDir: BaseDirectory.Data };

/** A document's text from an old app's data folder, or null if it has none. */
export async function readOldDocument(app: keyof typeof OLD_APPS, name: string): Promise<string | null> {
  const path = `${OLD_APPS[app]}/data/${name}.json`;
  if (!(await exists(path, opts))) return null;
  return readTextFile(path, opts);
}

/** The data inside a saved document's envelope, or null if the text isn't one. */
export function envelopeData(text: string | null): Record<string, unknown> | null {
  if (text === null) return null;
  try {
    const parsed = JSON.parse(text) as { data?: unknown };
    return typeof parsed.data === 'object' && parsed.data !== null ? (parsed.data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
