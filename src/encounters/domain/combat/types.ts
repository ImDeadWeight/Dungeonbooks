/**
 * @file Combat model: a combatant (one participant in an encounter, with
 * live HP, initiative, conditions and dying progress) and the encounter's
 * combat state (active or not, round, whose turn).
 */
import type { ActiveCondition } from '../conditions';
import type { Id } from '../ids';

/**
 * Where a combatant stands in the fight:
 * active  – in the initiative order
 * dying   – down and rolling each turn (death saves, recovery or stabilization
 *           checks, depending on the format); still in the initiative order
 * stable  – no longer dying but still down; out of the order
 * dead    – killed; out of the order
 */
export type CombatantStatus = 'active' | 'dying' | 'stable' | 'dead';

/**
 * Progress while dying. Which fields matter depends on the format's dying
 * rules: death saves use successes/failures (each 0–3); PF2e uses value (the
 * Dying condition's number). Negative-HP systems track it in HP instead.
 */
export interface DyingProgress {
  successes: number;
  failures: number;
  value: number;
}

/** Dying progress with nothing recorded. */
export function noDyingProgress(): DyingProgress {
  return { successes: 0, failures: 0, value: 0 };
}

/** One participant in an encounter. Stat block data lives on the linked template. */
export interface Combatant {
  id: Id;
  /** The character template this is a copy of (live link: stat block edits apply). */
  templateId: Id;
  /** Display name, numbered when there are several copies ("Goblin 2"). */
  name: string;
  /** null when HP isn't tracked (no stat block, e.g. a PC whose player tracks HP). */
  maxHp: number | null;
  /** Can go below 0 only in formats with negative-HP dying rules. */
  currentHp: number | null;
  tempHp: number;
  /** null until rolled or entered. */
  initiative: number | null;
  /** Stable order for ties and for listing outside combat. */
  addedOrder: number;
  /** Which physical token on the table this is, e.g. "red mini". */
  tokenDescription: string;
  /** Side-initiative formats: the side it acts with; '' = Party for PCs, Monsters for NPCs. */
  side: string;
  conditions: ActiveCondition[];
  status: CombatantStatus;
  dying: DyingProgress;
  /** Whether this turn's dying roll (death save, recovery or stabilization check) was recorded; gates Next Turn. */
  dyingRollMadeThisTurn: boolean;
}

/** An encounter's combat state. */
export interface CombatState {
  /** True from Roll for Initiative until End Combat. */
  active: boolean;
  /** Current round; 0 before the first turn starts. */
  round: number;
  /** Whose turn it is; null until every initiative has been entered. */
  currentId: Id | null;
}

/** Combat state for an encounter that isn't in combat. */
export function inactiveCombat(): CombatState {
  return { active: false, round: 0, currentId: null };
}

/** Whether the combatant still takes turns (active or making death saves). */
export function isInOrder(c: Combatant): boolean {
  return c.status === 'active' || c.status === 'dying';
}
