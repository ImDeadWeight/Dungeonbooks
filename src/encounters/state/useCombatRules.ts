/**
 * @file React hook giving components the combat rules (PC or not,
 * initiative modifiers, dying rules) for an encounter's format and the
 * current character templates.
 */
import { useMemo } from 'react';
import { combatRulesFrom, type CombatRules } from '../domain/combat/rules';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { useCharacters } from './characterStore';

/** Combat rules for a format that update when character templates change. */
export function useCombatRules(formatId: FormatId): CombatRules {
  const templates = useCharacters((s) => s.templates);
  return useMemo(() => combatRulesFrom(formatId, (id) => templates.find((t) => t.id === id)), [formatId, templates]);
}
