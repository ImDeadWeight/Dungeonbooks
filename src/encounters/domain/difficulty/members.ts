/**
 * @file Rating an encounter from who is in it: PCs make the party (by their
 * level), NPCs on the party's side are allies and don't count, and every
 * other NPC is a foe. With no PCs yet, the campaign's party stands in.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import type { CharacterTemplate } from '../characters';
import { PARTY_SIDE } from '../combat/initiative';
import { characterLevel, foeOf, raterFor } from './index';
import type { Difficulty, Foe } from './types';

/** One combatant (or one copy in the builder's cart), with the side it was put on ('' for none). */
export interface Member {
  template: CharacterTemplate;
  side: string;
}

/** The campaign's usual party, for encounters with no PCs in them yet. */
export interface PartyFallback {
  size: number;
  level: number;
}

const sideName = (m: Member) => m.side.trim() || (m.template.kind === 'pc' ? PARTY_SIDE : '');

/** How hard the encounter is, or null when the format has no rating or there is no party or no foe. */
export function rateMembers(formatId: FormatId, members: Member[], fallback?: PartyFallback | null): Difficulty | null {
  const rater = raterFor(formatId);
  if (!rater) return null;
  const pcs = members.filter((m) => m.template.kind === 'pc');
  const partySides = new Set(pcs.map(sideName).concat(PARTY_SIDE));
  const foes = members
    .filter((m) => m.template.kind === 'npc' && !partySides.has(sideName(m)))
    .map((m) => foeOf(m.template))
    .filter((f): f is Foe => f !== null);

  const notes: string[] = [];
  let party = pcs.map((m) => characterLevel(m.template) ?? 1);
  if (pcs.some((m) => characterLevel(m.template) === null)) notes.push('PCs without a stat block count as level 1.');
  if (!party.length && fallback) {
    party = Array.from({ length: fallback.size }, () => fallback.level);
    notes.push(`No PCs here yet: rated for the campaign's party of ${fallback.size} at level ${fallback.level}.`);
  }
  const result = rater(party, foes);
  return result && { ...result, notes: [...notes, ...result.notes] };
}
