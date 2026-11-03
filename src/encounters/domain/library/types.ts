/**
 * @file Library model: campaigns contain areas and encounters; areas contain
 * encounters and other areas; encounters contain combatants and their combat
 * state. The campaign list itself is the app's (src/campaigns); the
 * Encounters tab keeps each campaign's areas and encounters.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import type { Campaign } from '../../../campaigns/types';
import type { Id } from '../ids';
import type { Combatant } from '../combat/types';
import type { CombatState } from '../combat/types';

export type { Campaign };

/** A location within a campaign that groups encounters (e.g. "Cragmaw Cave"). */
export interface Area {
  id: Id;
  name: string;
  /** The campaign at the top of the chain; nested areas share their parent's campaign. */
  campaignId: Id;
  /** null = sits directly under its campaign; otherwise the area it is inside. */
  parentAreaId: Id | null;
}

/** A prepared fight: who's in it, and its live combat state. */
export interface Encounter {
  id: Id;
  name: string;
  campaignId: Id;
  /** null = sits directly under its campaign. */
  areaId: Id | null;
  /** The game system; every combatant's character uses it, and its combat rules apply. */
  formatId: FormatId;
  combatants: Combatant[];
  combat: CombatState;
}

/** Every campaign's areas and encounters, as stored in library.json. */
export interface EncounterLibrary {
  areas: Area[];
  encounters: Encounter[];
}

/** The library together with the campaign list, as tree operations and export/import see it. */
export interface Library extends EncounterLibrary {
  campaigns: Campaign[];
}

/** A library with nothing in it (first run). */
export function emptyLibrary(): EncounterLibrary {
  return { areas: [], encounters: [] };
}
