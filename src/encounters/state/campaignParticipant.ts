/**
 * @file The Encounters tab's part when campaigns are opened or deleted (see
 * campaigns/lifecycle.ts): the open encounter closes when another campaign
 * opens, and a deleted campaign's areas and encounters go with it.
 */
import { registerParticipant } from '../../campaigns/lifecycle';
import { useLibrary } from './libraryStore';
import { useUi } from './uiStore';

/** Joins in opening and deleting campaigns. */
export function startCampaignParticipant() {
  registerParticipant({
    opening(id) {
      const ui = useUi.getState();
      const open = useLibrary.getState().encounters.find((e) => e.id === ui.selectedEncounterId);
      if (open && open.campaignId !== id) ui.selectEncounter(null);
    },
    deleted(id) {
      useLibrary.getState().deleteCampaignContents(id);
    },
  });
}
