/**
 * @file Library model: campaigns contain areas and encounters; areas contain
 * encounters and other areas; encounters contain combatants and their combat
 * state.
 * Encounters with no campaign are "unfiled".
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import type { Id } from '../ids';
import type { Combatant } from '../combat/types';
import type { CombatState } from '../combat/types';

/** Top-level folder in the sidebar. */
export interface Campaign {
  id: Id;
  name: string;
  /** Default format for this campaign's new encounters and their new characters; null = none. */
  formatId: FormatId | null;
}

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
  /** null = unfiled (lives at the root of the sidebar). */
  campaignId: Id | null;
  /** null = sits directly under its campaign. */
  areaId: Id | null;
  /** The game system; every combatant's character uses it, and its combat rules apply. */
  formatId: FormatId;
  combatants: Combatant[];
  combat: CombatState;
}

/** Everything in the sidebar tree, as stored in library.json. */
export interface Library {
  campaigns: Campaign[];
  areas: Area[];
  encounters: Encounter[];
}

/** A library with nothing in it (first run). */
export function emptyLibrary(): Library {
  return { campaigns: [], areas: [], encounters: [] };
}
