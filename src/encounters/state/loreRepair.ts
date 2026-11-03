/**
 * @file Keeps characters pointing at their Lorekeeper pages after a notebook
 * is imported again (it gets a new id; see domain/loreRepair.ts). Looks
 * whenever the Lorekeeper tab's notebooks or linked catalogues change.
 */
import { useCatalogs } from '../../bridge/catalogs';
import { repairedLoreRefs } from '../domain/loreRepair';
import { useCharacters } from './characterStore';

/** Re-points characters whose notebook is gone at the linked notebook their page is in now. */
function repair() {
  const { notebooks, lore } = useCatalogs.getState();
  const { templates, saveTemplate } = useCharacters.getState();
  const repaired = repairedLoreRefs(templates, new Set(notebooks.map((n) => n.id)), Object.values(lore));
  for (const t of templates) {
    const ref = repaired.get(t.id);
    if (ref) saveTemplate({ ...t, lore: ref });
  }
}

/** Repairs now, then whenever the notebooks or their catalogues change. */
export function startLoreRepair() {
  repair();
  useCatalogs.subscribe((s, before) => {
    if (s.notebooks !== before.notebooks || s.lore !== before.lore) repair();
  });
}
