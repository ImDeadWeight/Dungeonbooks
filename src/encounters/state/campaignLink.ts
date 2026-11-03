/**
 * @file Encounters' side of the link with Lorekeeper: publishes the campaign
 * list and, for each linked campaign, its areas, encounters (combat state,
 * who's in them) and characters, for the Lorekeeper tab (see bridge/).
 */
import { makeEncountersCatalog, type EncountersCatalog } from 'campaign-link';
import { sameCatalogs, sameNames, useCatalogs } from '../../bridge/catalogs';
import { dropLinksWithout, useLinks } from '../../bridge/links';
import type { Id } from '../domain/ids';
import { useCharacters } from './characterStore';
import { useLibrary } from './libraryStore';

export { linkCampaign } from '../../bridge/links';

/** Wait this long after a change before publishing it, so bursts of edits publish once. */
const PUBLISH_DELAY_MS = 150;

/**
 * What Lorekeeper needs to know about a campaign: its areas, encounters, the
 * characters in them, and characters made from the linked notebook's pages
 * (with their stat blocks, so the page can take one).
 */
function buildCatalog(campaignId: Id, notebookId: Id): EncountersCatalog | null {
  const { campaigns, areas, encounters } = useLibrary.getState();
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign) return null;
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
      // Only pages of the linked notebook mean anything to it.
      .templates.filter((t) => used.has(t.id) || t.lore?.notebookId === notebookId)
      .map((t) => {
        const lorePageId = t.lore && t.lore.notebookId === notebookId ? t.lore.pageId : null;
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

/** Publishes the campaign list and every linked campaign's catalogue. */
function publish() {
  // A deleted campaign's link ends with it.
  dropLinksWithout('campaign', new Set(useLibrary.getState().campaigns.map((c) => c.id)));
  const fresh: Record<Id, EncountersCatalog> = {};
  for (const [campaignId, notebookId] of Object.entries(useLinks.getState().notebookByCampaign)) {
    const catalog = buildCatalog(campaignId, notebookId);
    if (catalog) fresh[campaignId] = catalog;
  }
  const campaigns = useLibrary.getState().campaigns.map((c) => ({ id: c.id, name: c.name }));
  useCatalogs.setState((s) => ({ campaigns: sameNames(s.campaigns, campaigns), encounters: sameCatalogs(s.encounters, fresh) }));
}

/** Publishes now, then shortly after every change Lorekeeper should see. */
export function startCampaignLink() {
  publish();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(publish, PUBLISH_DELAY_MS);
  };
  // Campaigns, areas, encounters, combat state, characters, and which campaigns are linked.
  useLibrary.subscribe(soon);
  useCharacters.subscribe((s, before) => {
    if (s.templates !== before.templates) soon();
  });
  useLinks.subscribe(soon);
}

