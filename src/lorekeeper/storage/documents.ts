/**
 * @file Lorekeeper's documents (each campaign's notes, the
 * sidebar's view), kept in their own folder (see storage/documents.ts).
 */
import { createDocuments } from '../../storage/documents';

/** The folder Lorekeeper's documents live in. */
export const LOREKEEPER_FOLDER = 'lorekeeper';

export const { loadDocument, saveDocument, removeDocument } = createDocuments(LOREKEEPER_FOLDER);
