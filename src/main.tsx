/**
 * @file App entry point: loads global styles; on first start copies the
 * separate apps' data in and makes one campaign list; loads the campaigns and
 * both tabs' data, then renders the shell (or an error message if loading
 * fails) and connects the tabs.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { startTabs, useTabs } from './bridge/navigation';
import { startCampaigns } from './campaigns/campaignStore';
import { setErrorReporter } from './campaigns/errors';
import { startAppLinks as startEncountersLinks } from './encounters/state/appLinks';
import { startCampaignParticipant as joinEncounters } from './encounters/state/campaignParticipant';
import { startCampaignLink as publishEncounters } from './encounters/state/campaignLink';
import { startLoreRepair } from './encounters/state/loreRepair';
import { startPersistence as loadEncounters } from './encounters/state/persistence';
import { useUi as useEncountersUi } from './encounters/state/uiStore';
import { startAppLinks as startLorekeeperLinks } from './lorekeeper/state/appLinks';
import { startCampaignParticipant as joinLorekeeper } from './lorekeeper/state/campaignParticipant';
import { startCampaignLink as publishLorekeeper } from './lorekeeper/state/campaignLink';
import { startPersistence as loadLorekeeper } from './lorekeeper/state/persistence';
import { useUi as useLorekeeperUi } from './lorekeeper/state/uiStore';
import { copyOldApps } from './migration/copyOldApps';
import { unifyCampaigns } from './migration/unifyCampaigns';
import { Shell } from './shell/Shell';
import './styles/theme.css';
import './styles/controls.css';

/** React root mounted on the #root element in index.html. */
const root = ReactDOM.createRoot(document.getElementById('root')!);

/** Styles apply per tab (see build/scopeTabCss.ts), so a tab is picked before anything is drawn. */
const markTab = () => {
  document.documentElement.dataset.tab = useTabs.getState().tab;
};
markTab();

/** Problems with campaigns show in the showing tab's notices. */
setErrorReporter((text) => {
  if (useTabs.getState().tab === 'lorekeeper') useLorekeeperUi.getState().notifyError(text);
  else useEncountersUi.getState().notify('error', text);
});

/** Copies the old apps' data if this is the first start, makes one campaign list, then loads everything. */
async function load(): Promise<string | null> {
  const copied = await copyOldApps();
  await unifyCampaigns();
  // Both tabs load the open campaign, so the list comes first.
  const campaignsWarning = await startCampaigns();
  await Promise.all([startTabs(), loadEncounters(), loadLorekeeper()]);
  if (campaignsWarning) useEncountersUi.getState().notify('error', campaignsWarning);
  return copied;
}

// Render only after data is loaded so nothing can overwrite saved files with empty state.
load()
  .then((copied) => {
    markTab();
    root.render(
      <React.StrictMode>
        <Shell />
      </React.StrictMode>,
    );
    if (copied) useEncountersUi.getState().notify('info', copied);
    joinEncounters();
    joinLorekeeper();
    publishEncounters();
    publishLorekeeper();
    startLoreRepair();
    startEncountersLinks();
    startLorekeeperLinks();
  })
  .catch((err: Error) => {
    root.render(<p className="empty-state">Dungeon Books could not load its data: {err.message}</p>);
  });
