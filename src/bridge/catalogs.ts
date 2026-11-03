/**
 * @file What each tab publishes for the other: the names of its campaigns or
 * notebooks, and a catalogue of each linked one. The catalogues are the same
 * ones the separate apps shared through the Campaign Link folder; here they
 * pass in memory, so changes show in the other tab right away.
 */
import { sameData, type EncountersCatalog, type LorekeeperCatalog } from 'campaign-link';
import { create } from 'zustand';

/** A campaign or notebook, as the other tab lists it. */
export interface Named {
  id: string;
  name: string;
}

interface CatalogState {
  /** Encounters' campaigns. */
  campaigns: Named[];
  /** Lorekeeper's notebooks. */
  notebooks: Named[];
  /** Each linked campaign's catalogue, by campaign id. */
  encounters: Record<string, EncountersCatalog>;
  /** Each linked notebook's catalogue, by notebook id. */
  lore: Record<string, LorekeeperCatalog>;
}

export const useCatalogs = create<CatalogState>(() => ({ campaigns: [], notebooks: [], encounters: {}, lore: {} }));

/** The fresh list, or the previous one when nothing changed (so readers don't redraw). */
export function sameNames(previous: Named[], fresh: Named[]): Named[] {
  const same = previous.length === fresh.length && previous.every((p, i) => p.id === fresh[i].id && p.name === fresh[i].name);
  return same ? previous : fresh;
}

/**
 * The fresh catalogues, keeping each previous one whose content didn't
 * change, and the previous record itself when none did.
 */
export function sameCatalogs<T extends EncountersCatalog | LorekeeperCatalog>(
  previous: Record<string, T>,
  fresh: Record<string, T>,
): Record<string, T> {
  const kept = Object.fromEntries(
    Object.entries(fresh).map(([id, catalog]) => [id, previous[id] && sameData(previous[id], catalog) ? previous[id] : catalog]),
  );
  const unchanged =
    Object.keys(kept).length === Object.keys(previous).length && Object.entries(kept).every(([id, c]) => previous[id] === c);
  return unchanged ? previous : kept;
}
