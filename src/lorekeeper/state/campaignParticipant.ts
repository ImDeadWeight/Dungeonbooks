/**
 * @file The Lorekeeper tab's part when campaigns are opened or deleted (see
 * campaigns/lifecycle.ts): opening a campaign loads its notes (saving the
 * open ones first) and clears out images its pages no longer use, and a
 * deleted campaign's notes file and images go with it.
 */
import { useCampaigns } from '../../campaigns/campaignStore';
import { registerParticipant } from '../../campaigns/lifecycle';
import { removeCampaignImages, removeUnusedImages } from './imageFiles';
import { useNotebook } from './notebookStore';
import { deleteNotebookFile, forgetView, openNotebook } from './persistence';

/** Deletes the open campaign's unused images; a failure only means they stay a while longer. */
function tidyImages(campaignId: string) {
  removeUnusedImages(campaignId, useNotebook.getState().pages).catch((err) => console.warn('Could not tidy images', err));
}

/** Joins in opening and deleting campaigns, and tidies the open campaign's images. */
export function startCampaignParticipant() {
  registerParticipant({
    async opening(id) {
      await openNotebook(id);
      tidyImages(id);
    },
    async deleted(id) {
      await deleteNotebookFile(id);
      await forgetView(id);
      await removeCampaignImages(id);
    },
  });
  const open = useCampaigns.getState().activeId;
  if (open) tidyImages(open);
}
