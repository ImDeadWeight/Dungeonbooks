/**
 * @file The whole window: the Encounters, Lorekeeper and Assistant tabs. All stay
 * mounted, so switching keeps each where it was (open dialogs, the caret in a
 * page); only the showing one is displayed. Each tab draws its own top bar,
 * with the tab switch in it. Settings and the campaign import preview, which
 * any tab can open, and the new-version notice are drawn here once.
 */
import { useLayoutEffect } from 'react';
import { AssistantApp } from '../assistant/ui/AssistantApp';
import { useTabs } from '../bridge/navigation';
import { App as EncountersApp } from '../encounters/ui/App';
import { App as LorekeeperApp } from '../lorekeeper/ui/App';
import { CampaignImportDialog } from '../transfer/ui/CampaignImportDialog';
import { UpdateToast } from '../updates/UpdateToast';
import { AiChangeToast } from './aiChanges/AiChangeToast';
import { SettingsDialog } from './Settings';
import './shell.css';

/** Both tabs; data-tab on <html> picks whose styles apply (see build/scopeTabCss.ts). */
export function Shell() {
  const tab = useTabs((s) => s.tab);
  useLayoutEffect(() => {
    document.documentElement.dataset.tab = tab;
  }, [tab]);
  return (
    <>
      <div className="shell-tab" hidden={tab !== 'encounters'}>
        <EncountersApp />
      </div>
      <div className="shell-tab" hidden={tab !== 'lorekeeper'}>
        <LorekeeperApp />
      </div>
      <div className="shell-tab" hidden={tab !== 'assistant'}>
        <AssistantApp />
      </div>
      <SettingsDialog />
      <CampaignImportDialog />
      <AiChangeToast />
      <UpdateToast />
    </>
  );
}
