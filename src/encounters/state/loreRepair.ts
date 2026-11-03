/**
 * @file Keeps characters pointing at their Lorekeeper pages after a notebook
 * is imported again (it gets a new id; see domain/loreRepair.ts). Looks
 * whenever the campaigns or the notes' catalogues change.
 */
import { useCatalogs } from '../../bridge/catalogs';
import { useCampaigns } from '../../campaigns/campaignStore';
import { repairedLoreRefs } from '../domain/loreRepair';
import { useCharacters } from './characterStore';

/** Re-points characters whose campaign is gone at the campaign their page is in now. */
function repair() {
  const { lore } = useCatalogs.getState();
  const { templates, saveTemplate } = useCharacters.getState();
  const campaignIds = new Set(useCampaigns.getState().campaigns.map((c) => c.id));
  const repaired = repairedLoreRefs(templates, campaignIds, Object.values(lore));
  for (const t of templates) {
    const ref = repaired.get(t.id);
    if (ref) saveTemplate({ ...t, lore: ref });
  }
}

/** Repairs now, then whenever the campaigns or the notes' catalogues change. */
export function startLoreRepair() {
  repair();
  useCatalogs.subscribe((s, before) => {
    if (s.lore !== before.lore) repair();
  });
  useCampaigns.subscribe((s, before) => {
    if (s.campaigns !== before.campaigns) repair();
  });
}
