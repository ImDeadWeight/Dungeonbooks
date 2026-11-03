/**
 * @file Condition defaults and data upgrades: looks up whether a condition
 * normally needs a save each turn, and fills in fields missing from custom
 * conditions saved or exported before conditions had rules text and a
 * per-turn flag.
 */
import type { CustomCondition } from './conditions';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { FORMAT_LIST } from 'campaign-link/formats/registry';
import type { Id } from './ids';

/** Default "save each turn" for a condition id: built-in or custom definition, else no. */
export function repeatsSaveLookup(customs: CustomCondition[]): (conditionId: Id) => boolean {
  const all = [...FORMAT_LIST.flatMap((f) => f.conditions), ...customs];
  return (conditionId) => all.find((c) => c.id === conditionId)?.repeatsSave ?? false;
}

/** Data saved before conditions had rules text / a per-turn flag. */
export type LegacyCustomCondition = Pick<CustomCondition, 'id' | 'name' | 'formatId'> & Partial<CustomCondition>;

/** Completes an older custom condition: no rules text and no per-turn save unless already set. */
export function upgradeCustomCondition(c: LegacyCustomCondition): CustomCondition {
  return { effect: '', endsWhen: '', repeatsSave: false, ...c, formatId: c.formatId as FormatId };
}
