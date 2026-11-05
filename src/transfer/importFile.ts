/**
 * @file Import, in any tab: asks for a file and sends it where it belongs.
 * A campaign file opens the campaign import preview; an Encounters export
 * opens Encounters' preview (in its tab); Lorekeeper notes are imported as
 * before.
 */
import { showTab } from '../bridge/navigation';
import { useCampaigns } from '../campaigns/campaignStore';
import { reportError } from '../campaigns/errors';
import { showImportPreview } from '../encounters/state/transferActions';
import { campaignNotes, importNotebook } from '../lorekeeper/state/notebooks';
import { importFileKind } from './fileKind';
import { openFile } from './files';
import { openImportDialog } from './importDialog';
import { parseCampaignFile } from './parseCampaignFile';

/** Asks for a file and starts importing it. */
export async function importFile(): Promise<void> {
  try {
    const picked = await openFile();
    if (!picked) return;
    let json: unknown;
    try {
      json = JSON.parse(picked.text);
    } catch {
      reportError("That file can't be imported: it is not valid JSON");
      return;
    }
    switch (importFileKind(json)) {
      case 'campaign':
        return await previewCampaignFile(picked.text);
      case 'encounters':
        showTab('encounters');
        return showImportPreview(picked.text);
      case 'notes':
        return await importNotebook(picked);
      default:
        reportError("That file can't be imported: it isn't a Dungeon Books, Encounters or Lorekeeper export");
    }
  } catch (err) {
    reportError('Could not open the file', err);
  }
}

/** Reads a campaign file and opens its preview, with what its campaign has here to compare against. */
async function previewCampaignFile(text: string): Promise<void> {
  const result = parseCampaignFile(text);
  if (!result.ok) {
    reportError(`That file can't be imported: ${result.error}`);
    return;
  }
  const here = useCampaigns.getState().campaigns.some((c) => c.id === result.file.campaign.id);
  openImportDialog({ file: result.file, notesHere: here ? await campaignNotes(result.file.campaign.id) : null });
}
