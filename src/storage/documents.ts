/**
 * @file Loading and saving JSON documents in a versioned envelope, on
 * whichever store the platform provides. Each part of the app (Encounters,
 * Lorekeeper, the shared links) keeps its documents in its own folder.
 * Unreadable files are backed up rather than overwritten.
 */
import { isTauri } from '../platform';
import { browserStore } from './browserStore';
import { tauriStore } from './tauriStore';
import type { DocumentStore } from './types';

/** Version written into saved documents; documents from newer versions are refused. */
const SCHEMA_VERSION = 1;

/** On-disk wrapper around a document's data. */
interface Envelope<T> {
  version: number;
  data: T;
}

/** A loaded document. */
export interface LoadResult<T> {
  data: T;
  /** Set when the stored file was unreadable and was backed up. */
  warning?: string;
}

/** The documents in one folder. */
export interface Documents {
  /**
   * Loads a document. A missing file yields the fallback. An unreadable file
   * is backed up next to the original and the fallback is used, so the user
   * never silently loses data to an overwrite. Fields missing from an older
   * document take the fallback's values.
   */
  loadDocument<T>(name: string, fallback: () => T): Promise<LoadResult<T>>;
  /** True when the document has been saved before. */
  hasDocument(name: string): Promise<boolean>;
  /** Deletes a document. */
  removeDocument(name: string): Promise<void>;
  /** Saves a document (pretty-printed JSON in the versioned envelope). */
  saveDocument<T>(name: string, data: T): Promise<void>;
  /** Saves a document's text exactly as given (used when copying the old apps' files). */
  saveRawDocument(name: string, text: string): Promise<void>;
}

/** The documents in `folder`: AppData files under Tauri, localStorage in a browser. */
export function createDocuments(folder: string): Documents {
  const store: DocumentStore = isTauri() ? tauriStore(folder) : browserStore(folder);
  return {
    async loadDocument<T>(name: string, fallback: () => T): Promise<LoadResult<T>> {
      const text = await store.read(name);
      if (text === null) return { data: fallback() };
      try {
        const parsed = JSON.parse(text) as Envelope<T>;
        if (typeof parsed !== 'object' || parsed === null || !('data' in parsed)) throw new Error('missing data');
        if (parsed.version > SCHEMA_VERSION) throw new Error(`saved by a newer version (${parsed.version})`);
        return { data: { ...fallback(), ...parsed.data } };
      } catch (err) {
        await store.backup(name, text);
        return {
          data: fallback(),
          warning: `${name}.json could not be read (${(err as Error).message}). A backup copy was saved and a fresh file started.`,
        };
      }
    },
    async hasDocument(name) {
      return (await store.read(name)) !== null;
    },
    async removeDocument(name) {
      await store.remove(name);
    },
    async saveDocument<T>(name: string, data: T) {
      const envelope: Envelope<T> = { version: SCHEMA_VERSION, data };
      await store.write(name, JSON.stringify(envelope, null, 2));
    },
    async saveRawDocument(name, text) {
      await store.write(name, text);
    },
  };
}
