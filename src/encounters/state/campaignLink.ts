/**
 * @file What the Lorekeeper tab needs from Encounters: the open campaign's
 * areas, encounters (combat state, who's in them) and characters, published
 * as a catalogue (see bridge/).
 */
import { makeEncountersCatalog, type EncountersCatalog } from 'campaign-link';
import { sameCatalogs, useCatalogs } from '../../bridge/catalogs';
import { useCampaigns } from '../../campaigns/campaignStore';
import type { Id } from '../domain/ids';
import { useCharacters } from './characterStore';
import { useLibrary } from './libraryStore';

/** Wait this long after a change before publishing it, so bursts of edits publish once. */
const PUBLISH_DELAY_MS = 150;

/**
 * What Lorekeeper needs to know about a campaign: its areas, encounters, the
 * characters in them, and characters made from its pages (with their stat
 * blocks, so a page can take one). A page reference names the campaign's id.
 */
function buildCatalog(campaignId: Id): EncountersCatalog | null {
  const campaign = useCampaigns.getState().campaigns.find((c) => c.id === campaignId);
  if (!campaign) return null;
  const { areas, encounters } = useLibrary.getState();
  const mine = encounters.filter((e) => e.campaignId === campaignId);
  const used = new Set(mine.flatMap((e) => e.combatants.map((c) => c.templateId)));
  return makeEncountersCatalog(campaignId, campaign.name, {
    ...(campaign.formatId ? { formatId: campaign.formatId } : {}),
    areas: areas
      .filter((a) => a.campaignId === campaignId)
      .map((a) => ({ id: a.id, name: a.name, parentAreaId: a.parentAreaId })),
    encounters: mine.map((e) => ({
      id: e.id,
      name: e.name,
      areaId: e.areaId,
      inCombat: e.combat.active,
      round: e.combat.active ? e.combat.round : 0,
      combatants: e.combatants.map((c) => ({ characterId: c.templateId, name: c.name, status: c.status })),
    })),
    characters: useCharacters
      .getState()
      .templates.filter((t) => used.has(t.id) || t.lore?.notebookId === campaignId)
      .map((t) => {
        const lorePageId = t.lore?.notebookId === campaignId ? t.lore.pageId : null;
        return {
          id: t.id,
          name: t.name,
          kind: t.kind,
          lorePageId,
          ...(lorePageId && t.statBlock ? { statBlock: { formatId: t.formatId, statBlock: t.statBlock } } : {}),
        };
      }),
  });
}

/** Publishes the open campaign's catalogue. */
function publish() {
  const { activeId } = useCampaigns.getState();
  const catalog = activeId ? buildCatalog(activeId) : null;
  const fresh: Record<Id, EncountersCatalog> = activeId && catalog ? { [activeId]: catalog } : {};
  useCatalogs.setState((s) => ({ encounters: sameCatalogs(s.encounters, fresh) }));
}

/** Publishes now, then shortly after every change Lorekeeper should see. */
export function startCampaignLink() {
  publish();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(publish, PUBLISH_DELAY_MS);
  };
  // Areas, encounters, combat state, characters, and the campaign (opening another, renaming, its format).
  useLibrary.subscribe(soon);
  useCharacters.subscribe((s, before) => {
    if (s.templates !== before.templates) soon();
  });
  useCampaigns.subscribe((s, before) => {
    // Right away when another campaign opens, so the Lorekeeper tab never shows the last one's.
    if (s.activeId !== before.activeId) publish();
    else if (s.campaigns !== before.campaigns) soon();
  });
}
