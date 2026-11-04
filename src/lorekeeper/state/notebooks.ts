/**
 * @file Exporting a campaign's notes to a file, and importing an exported
 * notebook. Creating, switching, renaming and deleting are the campaign's
 * (see campaigns/lifecycle.ts). Failures show as error notices.
 */
import { useCampaigns } from '../../campaigns/campaignStore';
import { createCampaign } from '../../campaigns/lifecycle';
import { newId, type Id } from '../domain/ids';
import { fromBase64, toBase64, type ImageData } from '../domain/imageExport';
import { imageIdsOf } from '../domain/images';
import { exportFileName, exportText, parseNotebookFile } from '../domain/library';
import type { Page } from '../domain/notebook';
import { openFile, saveFileAs } from '../storage/files';
import { imageBytes, putImageBytes } from './imageFiles';
import { useNotebook } from './notebookStore';
import { readNotebook, saveOpenNotebook, writeNotebook } from './persistence';
import { useUi } from './uiStore';

const notify = (what: string, err: unknown) => useUi.getState().notifyError(`${what}: ${(err as Error).message}`);

/** The pictures a campaign's pages show, for its export (missing files are left out). */
async function exportImages(campaignId: Id, pages: Page[]): Promise<ImageData> {
  const data: ImageData = {};
  for (const imageId of imageIdsOf(pages)) {
    const bytes = await imageBytes(campaignId, imageId);
    if (bytes) data[imageId] = toBase64(bytes);
  }
  return data;
}

/** Stores an import's pictures with a campaign's notes. */
async function importImages(campaignId: Id, images: ImageData): Promise<void> {
  for (const [imageId, base64] of Object.entries(images)) await putImageBytes(campaignId, imageId, fromBase64(base64));
}

/** Asks where to save, then writes a campaign's notes as one self-contained file. */
export async function exportNotebook(id: Id): Promise<void> {
  try {
    const { campaigns, activeId } = useCampaigns.getState();
    const campaign = campaigns.find((c) => c.id === id);
    if (!campaign) return;
    const { folders, pages } = useNotebook.getState();
    const notebook = id === activeId ? { folders, pages } : await readNotebook(id);
    await saveFileAs(exportFileName(campaign.name), exportText(campaign.name, notebook, await exportImages(id, notebook.pages)));
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
    const { name, notebook, images } = parseNotebookFile(file.text, file.baseName);
    const { folders, pages } = useNotebook.getState();
    if (folders.length === 0 && pages.length === 0) {
      await importImages(useCampaigns.getState().activeId!, images);
      useNotebook.getState().replaceAll(notebook);
      await saveOpenNotebook();
      return;
    }
    // Notes first, so the campaign list never names a campaign whose notes failed to save.
    const id = newId();
    await importImages(id, images);
    await writeNotebook(id, notebook);
    await createCampaign({ id, name });
  } catch (err) {
    notify('Could not import that file', err);
  }
}
