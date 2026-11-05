/**
 * @file A campaign's notes as a whole, for exports and imports: reading any
 * campaign's notes with their pictures, putting notes in (the open one's go
 * into the store, others to their file), and importing a notebook exported
 * by Lorekeeper or Dungeon Books 0.3 and earlier. Creating, switching,
 * renaming and deleting are the campaign's (see campaigns/lifecycle.ts).
 */
import { useCampaigns } from '../../campaigns/campaignStore';
import { createCampaign } from '../../campaigns/lifecycle';
import { newId, type Id } from '../domain/ids';
import { fromBase64, toBase64, type ImageData } from '../domain/imageExport';
import { imageIdsOf } from '../domain/images';
import { parseNotebookFile } from '../domain/library';
import { NOTEBOOK_FORMAT, type Notebook } from '../domain/notebook';
import { imageBytes, putImageBytes } from './imageFiles';
import { useNotebook } from './notebookStore';
import { openNotebookContents, readNotebook, saveOpenNotebook, writeNotebook } from './persistence';
import { useUi } from './uiStore';

const notify = (what: string, err: unknown) => useUi.getState().notifyError(`${what}: ${(err as Error).message}`);

/** A campaign's notes as saved (the open campaign's as they are now). */
export async function campaignNotes(campaignId: Id): Promise<Notebook> {
  return campaignId === useCampaigns.getState().activeId ? openNotebookContents() : readNotebook(campaignId);
}

/** The pictures a campaign's pages show, as base64 for an export (missing files are left out). */
export async function exportImages(campaignId: Id, notes: Notebook): Promise<ImageData> {
  const data: ImageData = {};
  for (const imageId of imageIdsOf(notes.pages)) {
    const bytes = await imageBytes(campaignId, imageId);
    if (bytes) data[imageId] = toBase64(bytes);
  }
  return data;
}

/**
 * Makes `notes` a campaign's notes, its pictures stored first. The open
 * campaign's notes change in place (and are saved now); any other's file is
 * written. The notes there before are replaced.
 */
export async function putCampaignNotes(campaignId: Id, notes: Notebook, images: ImageData): Promise<void> {
  for (const [imageId, base64] of Object.entries(images)) await putImageBytes(campaignId, imageId, fromBase64(base64));
  if (campaignId !== useCampaigns.getState().activeId) return writeNotebook(campaignId, { ...notes, format: NOTEBOOK_FORMAT });
  useNotebook.getState().replaceAll(notes);
  await saveOpenNotebook();
}

/**
 * Imports a notebook file (Lorekeeper's, or notes exported by Dungeon Books
 * 0.3 and earlier). Its notes fill the open campaign when that has none yet
 * (bringing a campaign's notes over after its encounters); otherwise they
 * become a new campaign. Notes are never replaced.
 */
export async function importNotebook(file: { baseName: string; text: string }): Promise<void> {
  try {
    const { name, notebook, images } = parseNotebookFile(file.text, file.baseName);
    const { folders, pages } = useNotebook.getState();
    if (folders.length === 0 && pages.length === 0) {
      await putCampaignNotes(useCampaigns.getState().activeId!, notebook, images);
      return;
    }
    // Notes first, so the campaign list never names a campaign whose notes failed to save.
    const id = newId();
    await putCampaignNotes(id, notebook, images);
    await createCampaign({ id, name });
  } catch (err) {
    notify('Could not import that file', err);
  }
}
