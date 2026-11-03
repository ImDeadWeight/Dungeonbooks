/**
 * @file Documents that belong to neither tab: the links between campaigns
 * and notebooks, the shell's view, and the record of what was copied from
 * the old apps.
 */
import { createDocuments } from '../storage/documents';

/** The folder the shared documents live in. */
export const SHARED_FOLDER = 'shared';

export const sharedDocuments = createDocuments(SHARED_FOLDER);
