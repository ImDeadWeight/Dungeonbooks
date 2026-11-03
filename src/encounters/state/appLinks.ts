/**
 * @file Links between the tabs: opening a Lorekeeper page, and opening an
 * encounter or character here when the Lorekeeper tab asks for one.
 */
import type { LinkTarget } from 'campaign-link';
import { openTarget, registerOpener } from '../../bridge/navigation';
import { switchCampaign } from '../../campaigns/lifecycle';
import type { LoreRef } from '../domain/characters';
import { useCharacters } from './characterStore';
import { useLibrary } from './libraryStore';
import { useUi } from './uiStore';

/** Opens a page in the Lorekeeper tab. */
export function openInLorekeeper(lore: LoreRef): void {
  openTarget({ app: 'lorekeeper', kind: 'page', notebookId: lore.notebookId, pageId: lore.pageId });
}

/** Shows the encounter (opening its campaign if needed) or character a link points at. */
async function handle(target: LinkTarget) {
  const ui = useUi.getState();
  if (target.kind === 'encounter') {
    const encounter = useLibrary.getState().encounters.find((e) => e.id === target.encounterId);
    if (!encounter) ui.notify('error', 'That encounter no longer exists.');
    else if (await switchCampaign(encounter.campaignId)) ui.selectEncounter(encounter.id);
  } else if (target.kind === 'character') {
    if (useCharacters.getState().templates.some((t) => t.id === target.characterId)) {
      ui.openModal({ type: 'editCharacter', templateId: target.characterId });
    } else ui.notify('error', 'That character no longer exists.');
  }
}

/** Lets the Lorekeeper tab open encounters and characters here. */
export function startAppLinks(): void {
  registerOpener('encounters', (target) => {
    handle(target);
  });
}
