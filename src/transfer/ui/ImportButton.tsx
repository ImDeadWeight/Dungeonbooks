/**
 * @file The top bars' Import button, the same in each tab: takes a campaign
 * file, an Encounters export or Lorekeeper notes (see importFile.ts).
 */
import { Upload } from 'lucide-react';
import { importFile } from '../importFile';

/** Import, with its label hidden where the bar is narrow (the tab's styles decide). */
export function ImportButton() {
  return (
    <button className="top-bar-import" title="Import a campaign, or an Encounters or Lorekeeper export" onClick={importFile}>
      <Upload size={16} /> <span className="top-bar-label">Import</span>
    </button>
  );
}
