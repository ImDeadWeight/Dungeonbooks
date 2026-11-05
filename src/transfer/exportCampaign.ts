/**
 * @file Export campaign: gathers one campaign's encounters (with the
 * characters, tags and conditions they use) and its notes (with their
 * pictures), and saves them as one campaign file where the user picks.
 */
import { useCampaigns } from '../campaigns/campaignStore';
import { reportError } from '../campaigns/errors';
import { exportCampaign as encountersOf } from '../encounters/domain/transfer/exportBundle';
import { currentAppData } from '../encounters/state/transferActions';
import { campaignNotes, exportImages } from '../lorekeeper/state/notebooks';
import { campaignFileName, campaignFileText } from './campaignFile';
import { saveFile } from './files';

/** Asks where to save, then writes the campaign as one file. Resolves true once saved. */
export async function exportCampaignFile(campaignId: string): Promise<boolean> {
  try {
    const campaign = useCampaigns.getState().campaigns.find((c) => c.id === campaignId);
    if (!campaign) return false;
    const notes = await campaignNotes(campaignId);
    const text = campaignFileText(campaign, encountersOf(currentAppData(), campaignId), notes, await exportImages(campaignId, notes));
    return await saveFile(campaignFileName(campaign.name), text);
  } catch (err) {
    reportError('Could not export the campaign', err);
    return false;
  }
}
