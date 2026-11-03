/**
 * @file Encounters' documents (library, characters, conditions), kept in
 * their own folder (see storage/documents.ts).
 */
import { createDocuments } from '../../storage/documents';

/** The folder Encounters' documents live in. */
export const ENCOUNTERS_FOLDER = 'encounters';

export const { loadDocument, saveDocument } = createDocuments(ENCOUNTERS_FOLDER);
