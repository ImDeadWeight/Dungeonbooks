/**
 * @file The top application bar: the tab switch, the campaign menu, and
 * Import, Connect AI and Settings buttons. On desktop it is also the window
 * title bar.
 */
import { hasCustomTitleBar } from '../../platform';
import { AiConnectButton } from '../../shell/AiConnect';
import { ImportButton } from '../../transfer/ui/ImportButton';
import { SettingsButton } from '../../shell/Settings';
import { CampaignMenu } from '../../shell/CampaignMenu';
import { TabSwitcher } from '../../shell/TabSwitcher';
import { WindowControls } from '../../shell/WindowControls';

/** Decided once at startup: draw window controls and drag regions? */
const customTitleBar = hasCustomTitleBar();

/**
 * App bar. On desktop it doubles as the window title bar: empty areas drag the
 * window (double-click maximizes) and the window buttons sit at the right.
 * Tauri only drags from elements that carry the attribute themselves.
 */
export function TopBar() {
  const drag = customTitleBar ? { 'data-tauri-drag-region': true } : {};
  return (
    <header className={`top-bar${customTitleBar ? ' title-bar' : ''}`} {...drag}>
      <TabSwitcher />
      <CampaignMenu />
      <span className="spacer" {...drag} />
      <ImportButton />
      <AiConnectButton />
      <SettingsButton />
      {customTitleBar && <WindowControls />}
    </header>
  );
}
