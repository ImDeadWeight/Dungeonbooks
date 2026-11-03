/**
 * @file Exporting a campaign's notes to a file, and importing an exported
 * notebook. Creating, switching, renaming and deleting are the campaign's
 * (see campaigns/lifecycle.ts). Failures show as error notices.
 */
import { useCampaigns } from '../../campaigns/campaignStore';
import { createCampaign } from '../../campaigns/lifecycle';
import { newId, type Id } from '../domain/ids';
import { exportFileName, exportText, parseNotebookFile } from '../domain/library';
import { openFile, saveFileAs } from '../storage/files';
import { useNotebook } from './notebookStore';
import { readNotebook, saveOpenNotebook, writeNotebook } from './persistence';
import { useUi } from './uiStore';

const notify = (what: string, err: unknown) => useUi.getState().notifyError(`${what}: ${(err as Error).message}`);

/** Asks where to save, then writes a campaign's notes as one self-contained file. */
export async function exportNotebook(id: Id): Promise<void> {
  try {
    const { campaigns, activeId } = useCampaigns.getState();
    const campaign = campaigns.find((c) => c.id === id);
    if (!campaign) return;
    const { folders, pages } = useNotebook.getState();
    const notebook = id === activeId ? { folders, pages } : await readNotebook(id);
    await saveFileAs(exportFileName(campaign.name), exportText(campaign.name, notebook));
  } catch (err) {
    notify('Could not export the notes', err);
  }
}

/**
 * Asks for an exported notebook file. Its notes fill the open campaign when
 * that has none yet (bringing a campaign's notes over after its encounters);
 * otherwise they become a new campaign. Notes are never replaced.
 */
export async function importNotebook(): Promise<void> {
  try {
    const file = await openFile();
    if (!file) return;
    const { name, notebook } = parseNotebookFile(file.text, file.baseName);
    const { folders, pages } = useNotebook.getState();
    if (folders.length === 0 && pages.length === 0) {
      useNotebook.getState().replaceAll(notebook);
      await saveOpenNotebook();
      return;
    }
    // Notes first, so the campaign list never names a campaign whose notes failed to save.
    const id = newId();
    await writeNotebook(id, notebook);
    await createCampaign({ id, name });
  } catch (err) {
    notify('Could not import that file', err);
  }
}
