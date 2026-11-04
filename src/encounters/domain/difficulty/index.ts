/**
 * @file Which formats rate encounters, and reading a character's level or CR
 * for it from its stat block.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import type { CharacterTemplate } from '../characters';
import { rate5e } from './dnd5e';
import { ratePf2e } from './pf2e';
import type { Foe, RateEncounter } from './types';

const RATERS: Partial<Record<FormatId, RateEncounter>> = {
  dnd5e: rate5e,
  dnd5e2024: rate5e,
  pf2e: ratePf2e,
  sf2e: ratePf2e,
};

/** The format's encounter rating, or undefined when it has no such rules. */
export const raterFor = (formatId: FormatId): RateEncounter | undefined => RATERS[formatId];

/** Stat block fields difficulty reads; every rated format has a level, 5e also a CR. */
type Rated = { level?: unknown; challengeRating?: unknown };

/** A PC's level from its stat block (null without one). */
export function characterLevel(t: CharacterTemplate): number | null {
  const level = (t.statBlock as Rated | null)?.level;
  return typeof level === 'number' ? level : null;
}

/** A foe as the format rates it: 5e by CR, PF2e/SF2e by level (null without a stat block). */
export function foeOf(t: CharacterTemplate): Foe | null {
  const sb = t.statBlock as Rated | null;
  if (!sb) return null;
  if (t.formatId === 'dnd5e' || t.formatId === 'dnd5e2024') return typeof sb.challengeRating === 'string' ? { cr: sb.challengeRating } : null;
  return typeof sb.level === 'number' ? { level: sb.level } : null;
}
