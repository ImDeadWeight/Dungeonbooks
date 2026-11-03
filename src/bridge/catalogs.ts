/**
 * @file What each tab publishes for the other: catalogues of the campaigns'
 * encounters and notes. They are the same catalogues the separate apps shared
 * through the Campaign Link folder; here they pass in memory, so changes show
 * in the other tab right away.
 */
import { sameData, type EncountersCatalog, type LorekeeperCatalog } from 'campaign-link';
import { create } from 'zustand';

interface CatalogState {
  /** The open campaign's encounters catalogue, by campaign id. */
  encounters: Record<string, EncountersCatalog>;
  /** Every campaign's notes catalogue, by campaign id. */
  lore: Record<string, LorekeeperCatalog>;
}

export const useCatalogs = create<CatalogState>(() => ({ encounters: {}, lore: {} }));

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
