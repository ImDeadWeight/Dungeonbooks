/**
 * @file Links between the tabs: opening an encounter or character in the
 * Encounters tab, and opening a page here (opening its campaign if needed)
 * when the Encounters tab asks for one.
 */
import type { LinkTarget } from 'campaign-link';
import { openTarget, registerOpener, useTabs } from '../../bridge/navigation';
import { useCampaigns } from '../../campaigns/campaignStore';
import { switchCampaign } from '../../campaigns/lifecycle';
import { useNotebook } from './notebookStore';
import { useUi } from './uiStore';

/** Opens an encounter or character in the Encounters tab. */
export function openInEncounters(target: Extract<LinkTarget, { app: 'encounters' }>): void {
  openTarget(target);
}

/** Opens the page a link points at (its notebook id is its campaign's), opening its campaign if needed. */
async function handle(target: LinkTarget) {
  if (target.kind !== 'page') return;
  const ui = useUi.getState();
  if (!useCampaigns.getState().campaigns.some((c) => c.id === target.notebookId)) {
    ui.notifyError('The campaign that page was in no longer exists.');
    return;
  }
  if (!(await switchCampaign(target.notebookId))) return; // switching failed and said why
  if (useNotebook.getState().pages.some((p) => p.id === target.pageId)) ui.selectPage(target.pageId);
  else ui.notifyError('That page no longer exists.');
}

/** Lets the Encounters tab open pages here; closes the peek when this tab is hidden. */
export function startAppLinks(): void {
  registerOpener('lorekeeper', (target) => {
    handle(target);
  });
  // The peek listens for Escape on the whole window; a hidden one would close from the other tab's keys.
  useTabs.subscribe((s, before) => {
    if (before.tab === 'lorekeeper' && s.tab !== 'lorekeeper') useUi.getState().closePeek();
  });
}
