/**
 * @file Upgrades encounters saved before encounters had a format, before
 * dying progress was format-neutral, and before conditions had a per-turn
 * flag or a value. Used when loading saved data.
 */
import type { Combatant } from '../combat/types';
import type { ActiveCondition, CustomCondition } from '../conditions';
import { repeatsSaveLookup } from '../conditionDefaults';
import type { FormatId } from 'campaign-link/formats/formatIds';
import type { Encounter } from './types';

/** The only format that existed before encounters stored one. */
export const LEGACY_FORMAT_ID: FormatId = 'dnd5e';

/** An applied condition from an older save; newer fields may be missing. */
type LegacyActiveCondition = Omit<ActiveCondition, 'requiresResolve' | 'value' | 'dropsEachTurn'> &
  Partial<Pick<ActiveCondition, 'requiresResolve' | 'value' | 'dropsEachTurn'>>;

/** A combatant from an older save: 5e death save fields instead of dying progress, no side. */
type LegacyCombatant = Omit<Combatant, 'dying' | 'dyingRollMadeThisTurn' | 'conditions' | 'side'> &
  Partial<Pick<Combatant, 'dying' | 'dyingRollMadeThisTurn' | 'side'>> & {
    conditions: LegacyActiveCondition[];
    deathSaves?: { successes: number; failures: number };
    deathSaveMadeThisTurn?: boolean;
  };

/** An encounter from an older save. */
export type LegacyEncounter = Omit<Encounter, 'formatId' | 'combatants'> & {
  formatId?: FormatId;
  combatants: LegacyCombatant[];
};

/** Fills in every field older saves lack; current data passes through unchanged in content. */
export function upgradeEncounters(encounters: LegacyEncounter[], customs: CustomCondition[]): Encounter[] {
  const repeats = repeatsSaveLookup(customs);
  return encounters.map((e) => ({
    ...e,
    formatId: e.formatId ?? LEGACY_FORMAT_ID,
    combatants: e.combatants.map(({ deathSaves, deathSaveMadeThisTurn, ...c }) => ({
      ...c,
      side: c.side ?? '',
      dying: c.dying ?? { successes: deathSaves?.successes ?? 0, failures: deathSaves?.failures ?? 0, value: 0 },
      dyingRollMadeThisTurn: c.dyingRollMadeThisTurn ?? deathSaveMadeThisTurn ?? false,
      conditions: c.conditions.map((x) => ({
        ...x,
        value: x.value ?? null,
        dropsEachTurn: x.dropsEachTurn ?? false,
        requiresResolve: x.requiresResolve ?? repeats(x.conditionId),
      })),
    })),
  }));
}
