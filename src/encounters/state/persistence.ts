/**
 * @file Connects the stores to saved files: loads library.json,
 * characters.json and conditions.json at startup (upgrading older data),
 * then saves each one shortly after its store changes.
 */
import { upgradeCustomCondition, type LegacyCustomCondition } from '../domain/conditionDefaults';
import { normalizeAreas } from '../domain/library/tree';
import { upgradeEncounters } from '../domain/library/upgrade';
import { emptyLibrary, type Area, type Campaign } from '../domain/library/types';
import { loadDocument, saveDocument } from '../storage/documents';
import { useCharacters } from './characterStore';
import { useLibrary } from './libraryStore';
import { useUi } from './uiStore';

/** Wait this long after the last change before writing, so bursts of edits save once. */
const SAVE_DELAY_MS = 400;

/** Returns a function that saves `snapshot()` to the named document after SAVE_DELAY_MS of quiet; failures show an error notice. */
function debouncedSaver<T>(name: string, snapshot: () => T) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      saveDocument(name, snapshot()).catch((err) =>
        useUi.getState().notify('error', `Could not save ${name}: ${(err as Error).message}`),
      );
    }, SAVE_DELAY_MS);
  };
}

/** Loads every document, then saves each store back whenever it changes. */
export async function startPersistence(): Promise<void> {
  const [library, characters, conditions] = await Promise.all([
    loadDocument('library', emptyLibrary),
    loadDocument('characters', () => ({ templates: [], tags: [] })),
    loadDocument('conditions', () => ({ custom: [] })),
  ]);
  for (const r of [library, characters, conditions]) {
    if (r.warning) useUi.getState().notify('error', r.warning);
  }

  // Older saves predate condition rules text and the per-turn save flag.
  const customConditions = (conditions.data.custom as LegacyCustomCondition[]).map(upgradeCustomCondition);
  useLibrary.getState().replaceAll({
    ...library.data,
    // Older saves predate campaign formats and nested areas.
    campaigns: library.data.campaigns.map((c: Campaign) => ({ ...c, formatId: c.formatId ?? null })),
    areas: normalizeAreas(library.data.areas.map((a: Area) => ({ ...a, parentAreaId: a.parentAreaId ?? null }))),
    // Older saves predate encounter formats, format-neutral dying progress and condition values.
    encounters: upgradeEncounters(library.data.encounters, customConditions),
  });
  useCharacters.getState().replaceAll({
    templates: characters.data.templates,
    tags: characters.data.tags,
    customConditions,
  });

  const saveLibrary = debouncedSaver('library', () => {
    const { campaigns, areas, encounters } = useLibrary.getState();
    return { campaigns, areas, encounters };
  });
  const saveCharacters = debouncedSaver('characters', () => {
    const { templates, tags } = useCharacters.getState();
    return { templates, tags };
  });
  const saveConditions = debouncedSaver('conditions', () => ({ custom: useCharacters.getState().customConditions }));

  useLibrary.subscribe(saveLibrary);
  useCharacters.subscribe((s, prev) => {
    if (s.templates !== prev.templates || s.tags !== prev.tags) saveCharacters();
    if (s.customConditions !== prev.customConditions) saveConditions();
  });
}
