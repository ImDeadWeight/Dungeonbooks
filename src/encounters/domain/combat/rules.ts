/**
 * @file The bridge between combat logic and game formats / character
 * templates: answers the questions combat needs (is this a PC, initiative
 * modifier, what 0 HP means) without the engine depending on stores or
 * formats directly.
 */
import { usesDeathSaves, type CharacterTemplate } from '../characters';
import type { FormatId } from 'campaign-link/formats/formatIds';
import type { DyingRules } from 'campaign-link/formats/formatTypes';
import { getFormat } from 'campaign-link/formats/registry';
import type { Id } from '../ids';

/**
 * The format and template facts combat logic needs, for one encounter's
 * format. Passed in so the engine stays pure and doesn't reach into stores.
 */
export interface CombatRules {
  /** Everyone rolls (individual), or each side rolls once a round (sides). */
  initiativeMode: 'individual' | 'sides';
  /** Die rolled for initiative. */
  initiativeDie: number;
  /** What 0 HP means in the encounter's format. */
  dying: DyingRules;
  /** Whether the character follows the dying rules at all (PCs always; NPCs opt in). */
  usesDeathSaves(templateId: Id): boolean;
  isPlayerCharacter(templateId: Id): boolean;
  initiativeModifier(templateId: Id): number;
  initiativeTiebreak(templateId: Id): number;
  /** negativeHp rules only: dead at minus this many HP (Infinity when unknown). */
  deathThreshold(templateId: Id): number;
}

/**
 * Builds CombatRules for an encounter's format from a template lookup. A
 * missing template (only possible with hand-edited data) is treated as an
 * NPC without dying rules and with no initiative modifier.
 */
export function combatRulesFrom(formatId: FormatId, lookup: (id: Id) => CharacterTemplate | undefined): CombatRules {
  const format = getFormat(formatId);
  // Runs fn for templates with a stat block; `fallback` for those without.
  const withStatBlock = (id: Id, fallback: number, fn: (t: CharacterTemplate) => number): number => {
    const t = lookup(id);
    return t?.statBlock ? fn(t) : fallback;
  };
  return {
    initiativeMode: format.initiativeMode,
    initiativeDie: format.initiativeDie,
    dying: format.dying,
    usesDeathSaves: (id) => {
      const t = lookup(id);
      return t ? usesDeathSaves(t) : false;
    },
    isPlayerCharacter: (id) => lookup(id)?.kind === 'pc',
    initiativeModifier: (id) => withStatBlock(id, 0, (t) => getFormat(t.formatId).initiativeModifier(t.statBlock!)),
    initiativeTiebreak: (id) => {
      const t = lookup(id);
      return t ? format.initiativeTiebreak(t.kind, t.formatId === formatId ? t.statBlock : null) : 0;
    },
    deathThreshold: (id) =>
      withStatBlock(id, Infinity, (t) => (format.deathThreshold && t.formatId === formatId ? format.deathThreshold(t.statBlock!) : Infinity)),
  };
}
