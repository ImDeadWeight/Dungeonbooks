/**
 * @file Library store: the campaigns, areas and encounters shown in the
 * sidebar, with actions to create, rename, move, update and delete them.
 * Saved to library.json by persistence.ts whenever it changes.
 */
import { create } from 'zustand';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { newId, type Id } from '../domain/ids';
import { inactiveCombat } from '../domain/combat/types';
import * as tree from '../domain/library/tree';
import { emptyLibrary, type Encounter, type Library } from '../domain/library/types';
import type { Combatant } from '../domain/combat/types';

/** The library data plus its actions. */
interface LibraryState extends Library {
  /** Replaces everything (used on load and after an import). */
  replaceAll(lib: Library): void;
  /** Creates a campaign and returns its id. */
  addCampaign(name: string, formatId?: FormatId | null): Id;
  /** Sets a campaign's default format (null = none). */
  setCampaignFormat(id: Id, formatId: FormatId | null): void;
  /** Creates an area in a campaign (optionally inside another area) and returns its id. */
  addArea(name: string, campaignId: Id, parentAreaId?: Id | null): Id;
  /** Creates an encounter (out of combat) with the given combatants and returns its id. */
  addEncounter(input: { name: string; campaignId: Id | null; areaId: Id | null; formatId: FormatId; combatants: Combatant[] }): Id;
  /** Changes an encounter's format; only allowed while it has no combatants. */
  setEncounterFormat(id: Id, formatId: FormatId): void;
  /** Renames a campaign, area or encounter. */
  rename(kind: 'campaign' | 'area' | 'encounter', id: Id, name: string): void;
  /** Swaps in an updated encounter (every combat action ends here). */
  replaceEncounter(enc: Encounter): void;
  /** Moves an encounter to the root, a campaign or an area. */
  moveEncounter(id: Id, dest: tree.EncounterDestination): void;
  /** Moves an area (with everything nested in it) into a campaign or another area. */
  moveArea(id: Id, dest: tree.AreaDestination): void;
  /** Deletes a campaign with its areas and encounters. */
  deleteCampaign(id: Id): void;
  /** Deletes an area with everything nested in it. */
  deleteArea(id: Id): void;
  /** Deletes one encounter. */
  deleteEncounter(id: Id): void;
  /** Updates the displayed name of a condition everywhere it is applied (after a custom condition is renamed). */
  renameAppliedCondition(conditionId: Id, name: string): void;
}

/** The library store hook. */
export const useLibrary = create<LibraryState>((set, get) => {
  // apply(): runs a pure tree operation on the current library and stores the result.
  const apply = (fn: (lib: Library) => Library) => {
    const { campaigns, areas, encounters } = get();
    set(fn({ campaigns, areas, encounters }));
  };
  return {
    ...emptyLibrary(),
    replaceAll: (lib) => set(lib),
    addCampaign(name, formatId = null) {
      const id = newId();
      set((s) => ({ campaigns: [...s.campaigns, { id, name, formatId }] }));
      return id;
    },
    setCampaignFormat: (id, formatId) =>
      set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, formatId } : c)) })),
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
      const key = kind === 'campaign' ? 'campaigns' : kind === 'area' ? 'areas' : 'encounters';
      set((s) => ({ [key]: (s[key] as { id: Id }[]).map((x) => (x.id === id ? { ...x, name } : x)) }));
    },
    replaceEncounter: (enc) => set((s) => ({ encounters: s.encounters.map((e) => (e.id === enc.id ? enc : e)) })),
    moveEncounter: (id, dest) => apply((lib) => tree.moveEncounter(lib, id, dest)),
    moveArea: (id, dest) => apply((lib) => tree.moveArea(lib, id, dest)),
    deleteCampaign: (id) => apply((lib) => tree.deleteCampaign(lib, id)),
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
  return useLibrary((s) => (campaignId ? s.campaigns.find((c) => c.id === campaignId)?.formatId ?? null : null));
}

/** React hook: the encounter with this id (re-renders when it changes), or undefined. */
export function useEncounter(id: Id | null): Encounter | undefined {
  return useLibrary((s) => (id ? s.encounters.find((e) => e.id === id) : undefined));
}
