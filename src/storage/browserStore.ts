/**
 * @file Document storage for plain-browser development (npm run dev):
 * documents live in localStorage.
 */
import type { DocumentStore } from './types';

/** Used when running in a plain browser (npm run dev without Tauri). */
export function browserStore(folder: string): DocumentStore {
  /** localStorage key for a document, e.g. "dungeon-books:encounters:library". */
  const key = (name: string) => `dungeon-books:${folder}:${name}`;
  return {
    async read(name) {
      return localStorage.getItem(key(name));
    },
    async write(name, text) {
      localStorage.setItem(key(name), text);
    },
    async backup(name, text) {
      localStorage.setItem(`${key(name)}.corrupt-${Date.now()}`, text);
    },
    async remove(name) {
      localStorage.removeItem(key(name));
    },
  };
}
