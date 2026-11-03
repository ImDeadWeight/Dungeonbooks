/**
 * @file The Lorekeeper tab's part when campaigns are opened or deleted (see
 * campaigns/lifecycle.ts): opening a campaign loads its notes (saving the
 * open ones first), and a deleted campaign's notes file goes with it.
 */
import { registerParticipant } from '../../campaigns/lifecycle';
import { deleteNotebookFile, forgetView, openNotebook } from './persistence';

/** Joins in opening and deleting campaigns. */
export function startCampaignParticipant() {
  registerParticipant({
    opening: (id) => openNotebook(id),
    async deleted(id) {
      await deleteNotebookFile(id);
      await forgetView(id);
    },
  });
}
