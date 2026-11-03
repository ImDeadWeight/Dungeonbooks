/**
 * @file Library store: every campaign's areas and encounters (the sidebar
 * shows the open campaign's), with actions to create, rename, move, update
 * and delete them. The campaign list is the app's (src/campaigns). Saved to
 * library.json by persistence.ts whenever it changes.
 */
import { create } from 'zustand';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { useCampaigns } from '../../campaigns/campaignStore';
import { newId, type Id } from '../domain/ids';
import { inactiveCombat } from '../domain/combat/types';
import * as tree from '../domain/library/tree';
import { emptyLibrary, type Encounter, type EncounterLibrary, type Library } from '../domain/library/types';
import type { Combatant } from '../domain/combat/types';

/** The library data plus its actions. */
interface LibraryState extends EncounterLibrary {
  /** Replaces everything (used on load and after an import). */
  replaceAll(lib: EncounterLibrary): void;
  /** Creates an area in a campaign (optionally inside another area) and returns its id. */
  addArea(name: string, campaignId: Id, parentAreaId?: Id | null): Id;
  /** Creates an encounter (out of combat) with the given combatants and returns its id. */
  addEncounter(input: { name: string; campaignId: Id; areaId: Id | null; formatId: FormatId; combatants: Combatant[] }): Id;
  /** Changes an encounter's format; only allowed while it has no combatants. */
  setEncounterFormat(id: Id, formatId: FormatId): void;
  /** Renames an area or encounter. */
  rename(kind: 'area' | 'encounter', id: Id, name: string): void;
  /** Swaps in an updated encounter (every combat action ends here). */
  replaceEncounter(enc: Encounter): void;
  /** Moves an encounter into a campaign or an area. */
  moveEncounter(id: Id, dest: tree.EncounterDestination): void;
  /** Moves an area (with everything nested in it) into a campaign or another area. */
  moveArea(id: Id, dest: tree.AreaDestination): void;
  /** Deletes a (deleted) campaign's areas and encounters. */
  deleteCampaignContents(id: Id): void;
  /** Deletes an area with everything nested in it. */
  deleteArea(id: Id): void;
  /** Deletes one encounter. */
  deleteEncounter(id: Id): void;
  /** Updates the displayed name of a condition everywhere it is applied (after a custom condition is renamed). */
  renameAppliedCondition(conditionId: Id, name: string): void;
}

/** The library store hook. */
export const useLibrary = create<LibraryState>((set, get) => {
  // apply(): runs a pure tree operation on the current library (with the campaign list) and stores its areas and encounters.
  const apply = (fn: (lib: Library) => Library) => {
    const { areas, encounters } = get();
    const next = fn({ campaigns: useCampaigns.getState().campaigns, areas, encounters });
    set({ areas: next.areas, encounters: next.encounters });
  };
  return {
    ...emptyLibrary(),
    replaceAll: (lib) => set({ areas: lib.areas, encounters: lib.encounters }),
    addArea(name, campaignId, parentAreaId = null) {
      const id = newId();
      set((s) => ({ areas: [...s.areas, { id, name, campaignId, parentAreaId }] }));
      return id;
    },
    addEncounter({ name, campaignId, areaId, formatId, combatants }) {
      const id = newId();
      set((s) => ({ encounters: [...s.encounters, { id, name, campaignId, areaId, formatId, combatants, combat: inactiveCombat() }] }));
      return id;
    },
    setEncounterFormat: (id, formatId) =>
      set((s) => ({
        encounters: s.encounters.map((e) => (e.id === id && e.combatants.length === 0 ? { ...e, formatId } : e)),
      })),
    rename(kind, id, name) {
      const key = kind === 'area' ? 'areas' : 'encounters';
      set((s) => ({ [key]: (s[key] as { id: Id }[]).map((x) => (x.id === id ? { ...x, name } : x)) }));
    },
    replaceEncounter: (enc) => set((s) => ({ encounters: s.encounters.map((e) => (e.id === enc.id ? enc : e)) })),
    moveEncounter: (id, dest) => apply((lib) => tree.moveEncounter(lib, id, dest)),
    moveArea: (id, dest) => apply((lib) => tree.moveArea(lib, id, dest)),
    deleteCampaignContents: (id) => apply((lib) => tree.deleteCampaignContents(lib, id)),
    deleteArea: (id) => apply((lib) => tree.deleteArea(lib, id)),
    deleteEncounter: (id) => apply((lib) => tree.deleteEncounter(lib, id)),
    renameAppliedCondition: (conditionId, name) =>
      set((s) => ({
        encounters: s.encounters.map((e) =>
          e.combatants.some((c) => c.conditions.some((x) => x.conditionId === conditionId))
            ? {
                ...e,
                combatants: e.combatants.map((c) => ({
                  ...c,
                  conditions: c.conditions.map((x) => (x.conditionId === conditionId ? { ...x, name } : x)),
                })),
              }
            : e,
        ),
      })),
  };
});

/** React hook: the default format of a campaign (null if none or no campaign). */
export function useCampaignFormat(campaignId: Id | null | undefined): FormatId | null {
  return useCampaigns((s) => (campaignId ? s.campaigns.find((c) => c.id === campaignId)?.formatId ?? null : null));
}

/** The default format of a campaign (null if none), from outside React. */
export function campaignFormat(campaignId: Id | null): FormatId | null {
  return useCampaigns.getState().campaigns.find((c) => c.id === campaignId)?.formatId ?? null;
}

/** React hook: the encounter with this id (re-renders when it changes), or undefined. */
export function useEncounter(id: Id | null): Encounter | undefined {
  return useLibrary((s) => (id ? s.encounters.find((e) => e.id === id) : undefined));
}
