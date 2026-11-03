/**
 * @file The whole window: the Encounters and Lorekeeper tabs. Both stay
 * mounted, so switching keeps each where it was (open dialogs, the caret in a
 * page); only the showing one is displayed. Each tab draws its own top bar,
 * with the tab switch in it.
 */
import { useLayoutEffect } from 'react';
import { useTabs } from '../bridge/navigation';
import { App as EncountersApp } from '../encounters/ui/App';
import { App as LorekeeperApp } from '../lorekeeper/ui/App';
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
    </>
  );
}
