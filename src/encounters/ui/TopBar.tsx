/**
 * @file The top application bar: the tab switch, then Create (+), Import,
 * Backup, Characters and Conditions buttons. On desktop it is also the window
 * title bar.
 */
import { Download, Plus, Upload, Users } from 'lucide-react';
import { hasCustomTitleBar } from '../../platform';
import { exportItems, startImport } from '../state/transferActions';
import { useUi } from '../state/uiStore';
import { TabSwitcher } from '../../shell/TabSwitcher';
import { WindowControls } from '../../shell/WindowControls';
import { HealingIcon } from './common/HealingIcon';

/** Decided once at startup: draw window controls and drag regions? */
const customTitleBar = hasCustomTitleBar();

/**
 * App bar. On desktop it doubles as the window title bar: empty areas drag the
 * window (double-click maximizes) and the window buttons sit at the right.
 * Tauri only drags from elements that carry the attribute themselves.
 */
export function TopBar() {
  const openModal = useUi((s) => s.openModal);
  const drag = customTitleBar ? { 'data-tauri-drag-region': true } : {};
  return (
    <header className={`top-bar${customTitleBar ? ' title-bar' : ''}`} {...drag}>
      <TabSwitcher />
      <button className="primary" title="Create…" onClick={() => openModal({ type: 'create', preset: { kind: null } })}>
        <Plus size={20} />
      </button>
      <span className="spacer" {...drag} />
      <button title="Import from a file" onClick={startImport}>
        <Upload size={16} /> Import
      </button>
      <button title="Save a backup of everything" onClick={() => exportItems({ kind: 'everything' })}>
        <Download size={16} /> Backup
      </button>
      <button onClick={() => openModal({ type: 'characters' })}>
        <Users size={16} /> Characters
      </button>
      <button title="Create and edit conditions" onClick={() => openModal({ type: 'conditions' })}>
        <HealingIcon size={16} /> Conditions
      </button>
      {customTitleBar && <WindowControls />}
    </header>
  );
}
