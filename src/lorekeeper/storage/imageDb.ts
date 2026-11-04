/**
 * @file Images in the browser (npm run dev): one IndexedDB store, keyed by
 * "<campaign id>/<image id>". localStorage is too small for pictures.
 */
import type { ImageStore } from './images';

const DB = 'dungeon-books-images';
const STORE = 'images';

let opened: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opened;
}

/** Runs one request in a transaction and resolves with its result. */
async function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const store = (await db()).transaction(STORE, mode).objectStore(STORE);
  return new Promise((resolve, reject) => {
    const request = act(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function browserImages(campaignId: string): ImageStore {
  const key = (imageId: string) => `${campaignId}/${imageId}`;
  const range = IDBKeyRange.bound(`${campaignId}/`, `${campaignId}/￿`);
  return {
    async put(imageId, bytes) {
      await run('readwrite', (s) => s.put(bytes, key(imageId)));
    },
    async get(imageId) {
      return ((await run('readonly', (s) => s.get(key(imageId)))) as Uint8Array | undefined) ?? null;
    },
    async list() {
      const keys = await run('readonly', (s) => s.getAllKeys(range));
      return keys.map((k) => String(k).slice(campaignId.length + 1));
    },
    async remove(imageId) {
      await run('readwrite', (s) => s.delete(key(imageId)));
    },
    async removeAll() {
      await run('readwrite', (s) => s.delete(range));
    },
  };
}
