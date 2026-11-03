/**
 * @file App entry point: loads global styles; on first start copies the
 * separate apps' data in; loads both tabs' saved data, then renders the shell
 * (or an error message if loading fails) and connects the tabs.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { startLinks } from './bridge/links';
import { startTabs, useTabs } from './bridge/navigation';
import { startAppLinks as startEncountersLinks } from './encounters/state/appLinks';
import { startCampaignLink as publishEncounters } from './encounters/state/campaignLink';
import { startLoreRepair } from './encounters/state/loreRepair';
import { startPersistence as loadEncounters } from './encounters/state/persistence';
import { useUi as useEncountersUi } from './encounters/state/uiStore';
import { startAppLinks as startLorekeeperLinks } from './lorekeeper/state/appLinks';
import { startCampaignLink as publishLorekeeper } from './lorekeeper/state/campaignLink';
import { startPersistence as loadLorekeeper } from './lorekeeper/state/persistence';
import { copyOldApps } from './migration/copyOldApps';
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

/** Copies the old apps' data if this is the first start, then loads everything. */
async function load(): Promise<string | null> {
  const copied = await copyOldApps();
  const [linksWarning] = await Promise.all([startLinks(), startTabs(), loadEncounters(), loadLorekeeper()]);
  if (linksWarning) useEncountersUi.getState().notify('error', linksWarning);
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
    publishEncounters();
    publishLorekeeper();
    startLoreRepair();
    startEncountersLinks();
    startLorekeeperLinks();
  })
  .catch((err: Error) => {
    root.render(<p className="empty-state">Dungeon Books could not load its data: {err.message}</p>);
  });
