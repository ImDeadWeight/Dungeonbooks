/**
 * @file The campaign file being imported, while its preview is open. The
 * shell draws the preview (any tab can import); null when none is open.
 */
import { create } from 'zustand';
import type { Notebook } from '../lorekeeper/domain/notebook';
import type { CampaignFile } from './campaignFile';

/** A campaign file to preview, with the notes its campaign has here (null when it isn't here). */
export interface PendingImport {
  file: CampaignFile;
  notesHere: Notebook | null;
}

export const useImportDialog = create<{ pending: PendingImport | null }>(() => ({ pending: null }));

export const openImportDialog = (pending: PendingImport) => useImportDialog.setState({ pending });

export const closeImportDialog = () => useImportDialog.setState({ pending: null });
