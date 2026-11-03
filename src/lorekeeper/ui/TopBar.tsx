/**
 * @file The top application bar: the tab switch, the campaign menu and an
 * Import button. On desktop it is also the window title bar.
 */
import { Upload } from 'lucide-react';
import { hasCustomTitleBar } from '../../platform';
import { importNotebook } from '../state/notebooks';
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
      <button className="top-bar-import" title="Import notes from an exported notebook (into this campaign if it has none yet, else as a new campaign)" onClick={importNotebook}>
        <Upload size={16} /> <span className="top-bar-label">Import</span>
      </button>
      {customTitleBar && <WindowControls />}
    </header>
  );
}
