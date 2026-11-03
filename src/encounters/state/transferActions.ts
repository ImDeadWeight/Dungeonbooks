/**
 * @file Export and import actions behind the UI buttons: gathers the app's
 * data, runs the pure export/import logic, uses the platform file dialogs,
 * commits imports to the stores, and reports results as notices.
 */
import { applyImport, type Placement } from '../domain/transfer/applyImport';
import * as exporters from '../domain/transfer/exportBundle';
import { parseTransferFile } from '../domain/transfer/parseFile';
import type { ImportPlan, Resolution } from '../domain/transfer/plan';
import type { AppData, Bundle, TransferFile, TransferKind } from '../domain/transfer/types';
import type { Id } from '../domain/ids';
import { openTextFile, saveTextFile } from '../storage/fileTransfer';
import { useCharacters } from './characterStore';
import { useCombatHistory } from './combatStore';
import { useLibrary } from './libraryStore';
import { useUi } from './uiStore';

/** A snapshot of everything in the library and character stores. */
function currentAppData(): AppData {
  const { campaigns, areas, encounters } = useLibrary.getState();
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
    const saved = await saveTextFile(exporters.exportFileName(name), JSON.stringify(file, null, 2));
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

/** Opens a file, validates it fully, then shows the import preview. */
export async function startImport() {
  const ui = useUi.getState();
  try {
    const text = await openTextFile();
    if (text === null) return;
    const result = parseTransferFile(text);
    if (!result.ok) {
      ui.notify('error', `That file can't be imported: ${result.error}`);
      return;
    }
    ui.openModal({ type: 'importPreview', file: result.file });
  } catch (err) {
    ui.notify('error', `Could not open the file: ${errorText(err)}`);
  }
}

/** All-or-nothing: the stores only change if the merge succeeds. */
export function commitImport(file: TransferFile, plan: ImportPlan, resolutions: Record<string, Resolution>, placement: Placement): boolean {
  const ui = useUi.getState();
  try {
    const { data, summary } = applyImport(currentAppData(), file, plan, resolutions, placement);
    useLibrary.getState().replaceAll({ campaigns: data.campaigns, areas: data.areas, encounters: data.encounters });
    useCharacters.getState().replaceAll({ templates: data.templates, tags: data.tags, customConditions: data.customConditions });
    // Undo history for overwritten encounters would restore pre-import state; drop it.
    for (const item of plan.items) {
      if (item.type === 'encounter' && resolutions[item.key] === 'theirs') useCombatHistory.getState().clear(item.id);
    }
    const parts = [
      summary.added && `${summary.added} added`,
      summary.replaced && `${summary.replaced} replaced`,
      summary.copied && `${summary.copied} copied`,
      summary.skipped && `${summary.skipped} already present`,
    ].filter(Boolean);
    ui.notify('info', `Import complete: ${parts.join(', ') || 'nothing to change'}.`);
    return true;
  } catch (err) {
    ui.notify('error', `Import failed, nothing was changed: ${errorText(err)}`);
    return false;
  }
}
