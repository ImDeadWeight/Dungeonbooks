/**
 * @file Encounters' export and import actions: gathers the app's data, runs
 * the pure export/import logic, saves exports to a file the user picks,
 * commits imports to the stores, and reports results as notices. Campaign
 * files (both tabs' data) are src/transfer/'s, which use these for their
 * encounters.
 */
import { useCampaigns } from '../../campaigns/campaignStore';
import { mergeImportedCampaigns } from '../../campaigns/lifecycle';
import { applyImport, type Placement } from '../domain/transfer/applyImport';
import * as exporters from '../domain/transfer/exportBundle';
import { parseTransferFile } from '../domain/transfer/parseFile';
import type { ImportPlan, Resolution } from '../domain/transfer/plan';
import type { AppData, Bundle, TransferFile, TransferKind } from '../domain/transfer/types';
import type { ImportSummary } from '../domain/transfer/applyImport';
import type { Id } from '../domain/ids';
import { saveFile } from '../../transfer/files';
import { useCharacters } from './characterStore';
import { useCombatHistory } from './combatStore';
import { useLibrary } from './libraryStore';
import { useUi } from './uiStore';

/** A snapshot of the campaigns and everything in the library and character stores. */
export function currentAppData(): AppData {
  const { campaigns } = useCampaigns.getState();
  const { areas, encounters } = useLibrary.getState();
  const { templates, tags, customConditions } = useCharacters.getState();
  return { campaigns, areas, encounters, templates, tags, customConditions };
}

/** A readable message from any thrown value. */
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Wraps a bundle in the file format and asks the user where to save it (named after the item). */
async function writeExport(kind: TransferKind, bundle: Bundle, name: string) {
  const ui = useUi.getState();
  try {
    const file = exporters.toTransferFile(kind, bundle);
    const saved = await saveFile(exporters.exportFileName(name), JSON.stringify(file, null, 2));
    if (saved) ui.notify('info', `Exported ${name}.`);
  } catch (err) {
    ui.notify('error', `Export failed: ${errorText(err)}`);
  }
}

/** What to export: one campaign/area/encounter, a set of characters, or everything. */
export type ExportTarget =
  | { kind: 'campaign' | 'area' | 'encounter'; id: Id; name: string }
  | { kind: 'characters'; ids: Id[] }
  | { kind: 'everything' };

/** Builds the right export bundle for the target and saves it to a file the user picks. */
export function exportItems(target: ExportTarget) {
  const state = currentAppData();
  switch (target.kind) {
    case 'campaign':
      return writeExport('campaign', exporters.exportCampaign(state, target.id), target.name);
    case 'area':
      return writeExport('area', exporters.exportArea(state, target.id), target.name);
    case 'encounter':
      return writeExport('encounter', exporters.exportEncounter(state, target.id), target.name);
    case 'characters': {
      const only = target.ids.length === 1 ? state.templates.find((t) => t.id === target.ids[0])?.name : undefined;
      return writeExport('characters', exporters.exportCharacters(state, target.ids), only ?? `${target.ids.length} characters`);
    }
    case 'everything':
      return writeExport('everything', exporters.exportEverything(state), `Encounters backup ${new Date().toISOString().slice(0, 10)}`);
  }
}

/** Validates an Encounters export fully, then shows the import preview (Import, see src/transfer/, picks the file). */
export function showImportPreview(text: string) {
  const ui = useUi.getState();
  const result = parseTransferFile(text);
  if (!result.ok) {
    ui.notify('error', `That file can't be imported: ${result.error}`);
    return;
  }
  ui.openModal({ type: 'importPreview', file: result.file });
}

/**
 * Puts merged data (from applyImport) into the stores, campaigns first so
 * imported areas and encounters never point at a campaign the list doesn't
 * have. Encounters the import replaced lose their undo history.
 */
export function storeImport(data: AppData, plan: ImportPlan, resolutions: Record<string, Resolution>) {
  mergeImportedCampaigns(data.campaigns);
  useLibrary.getState().replaceAll({ areas: data.areas, encounters: data.encounters });
  useCharacters.getState().replaceAll({ templates: data.templates, tags: data.tags, customConditions: data.customConditions });
  // Undo history for overwritten encounters would restore pre-import state; drop it.
  for (const item of plan.items) {
    if (item.type === 'encounter' && resolutions[item.key] === 'theirs') useCombatHistory.getState().clear(item.id);
  }
}

/** "3 added, 1 replaced" for a finished import. */
export function summaryText(summary: ImportSummary): string {
  const parts = [
    summary.added && `${summary.added} added`,
    summary.replaced && `${summary.replaced} replaced`,
    summary.copied && `${summary.copied} copied`,
    summary.skipped && `${summary.skipped} already present`,
  ].filter(Boolean);
  return parts.join(', ') || 'nothing to change';
}

/** All-or-nothing: the stores only change if the merge succeeds. */
export function commitImport(file: TransferFile, plan: ImportPlan, resolutions: Record<string, Resolution>, placement: Placement): boolean {
  const ui = useUi.getState();
  try {
    const { data, summary } = applyImport(currentAppData(), file, plan, resolutions, placement);
    storeImport(data, plan, resolutions);
    ui.notify('info', `Import complete: ${summaryText(summary)}.`);
    return true;
  } catch (err) {
    ui.notify('error', `Import failed, nothing was changed: ${errorText(err)}`);
    return false;
  }
}
