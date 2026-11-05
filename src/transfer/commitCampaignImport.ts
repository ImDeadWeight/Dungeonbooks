/**
 * @file Importing a previewed campaign file: merges its encounters as the
 * user chose, puts its notes in (into the campaign, its copy, or not at all,
 * see campaignPlan.ts) with encounter links pointing at the encounters'
 * final ids, then opens the campaign if it is new here.
 */
import { reportError } from '../campaigns/errors';
import { switchCampaign } from '../campaigns/lifecycle';
import { applyImport } from '../encounters/domain/transfer/applyImport';
import type { ImportPlan, ItemStatus, Resolution } from '../encounters/domain/transfer/plan';
import { currentAppData, storeImport, summaryText } from '../encounters/state/transferActions';
import { useUi as useEncountersUi } from '../encounters/state/uiStore';
import { renameEncounterLinks } from '../lorekeeper/domain/encounterLinks';
import { putCampaignNotes } from '../lorekeeper/state/notebooks';
import type { CampaignFile } from './campaignFile';
import { notesAction } from './campaignPlan';

/** Imports the file; resolves false (having said why) if it failed, in which case the notes may be in but nothing else changed. */
export async function commitCampaignImport(
  file: CampaignFile,
  plan: ImportPlan,
  resolutions: Record<string, Resolution>,
  notes: ItemStatus,
): Promise<boolean> {
  try {
    const action = notesAction(file, plan, resolutions, notes);
    // Pure, so nothing has changed if it throws.
    const applied = applyImport(currentAppData(), file.encounters, plan, resolutions, { campaignId: file.campaign.id, areaId: null }, { withNotes: true });
    const campaignId = applied.finalId('campaign', file.campaign.id);
    // Notes before the campaign list, so it never names a campaign whose notes failed to save.
    if (action !== 'skip') {
      const linked = renameEncounterLinks(file.notes, (id) => applied.finalId('encounter', id));
      await putCampaignNotes(campaignId, linked, file.images);
    }
    storeImport(applied.data, plan, resolutions);
    // A campaign new here (or a copy) opens; one already here stays as it is.
    const wasHere = plan.items.some((i) => i.type === 'campaign' && i.id === file.campaign.id && i.status !== 'new');
    if (!wasHere || campaignId !== file.campaign.id) await switchCampaign(campaignId);
    useEncountersUi.getState().notify('info', `Imported "${file.campaign.name}": ${summaryText(applied.summary)}${action === 'skip' ? '' : ', notes included'}.`);
    return true;
  } catch (err) {
    reportError('Import failed', err);
    return false;
  }
}
