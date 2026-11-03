/**
 * @file The storage interface each platform implements (Tauri files,
 * browser localStorage).
 */

/** Raw text storage for named JSON documents. Platform adapters implement this. */
export interface DocumentStore {
  /** The document's text, or null if it has never been saved. */
  read(name: string): Promise<string | null>;
  /** Saves the document's text, replacing any previous version. */
  write(name: string, text: string): Promise<void>;
  /** Keep a copy of unreadable data before it would be overwritten. */
  backup(name: string, text: string): Promise<void>;
  /** Deletes the document (nothing happens if it doesn't exist). */
  remove(name: string): Promise<void>;
}
