/**
 * @file PF2e (and SF2e, on the same engine) threat, from Pathfinder GM Core's
 * encounter building (ORC License): each creature costs XP by its level
 * against the party's, and the threat budgets are for four characters, moved
 * by a character adjustment for each one more or fewer.
 */
import { rate, type Difficulty, type Foe, type PartyLevels, type Threshold } from './types';

/** Creature XP by its level minus the party's, −4 to +4. */
const XP_BY_LEVEL_DIFFERENCE: Record<number, number> = { [-4]: 10, [-3]: 15, [-2]: 20, [-1]: 30, 0: 40, 1: 60, 2: 80, 3: 120, 4: 160 };

/** Threats with their budget for four characters and the adjustment per character. */
const THREATS: { name: string; budget: number; perCharacter: number }[] = [
  { name: 'Trivial', budget: 40, perCharacter: 10 },
  { name: 'Low', budget: 60, perCharacter: 20 },
  { name: 'Moderate', budget: 80, perCharacter: 20 },
  { name: 'Severe', budget: 120, perCharacter: 30 },
  { name: 'Extreme', budget: 160, perCharacter: 40 },
];

/** The party level: the characters' level, or their average when they differ. */
export function partyLevel(party: PartyLevels): number {
  return Math.round(party.reduce((a, b) => a + b, 0) / party.length);
}

/** Rates PF2e foes against the party. */
export function ratePf2e(party: PartyLevels, foes: Foe[]): Difficulty | null {
  if (!party.length || !foes.length) return null;
  const level = partyLevel(party);
  const extra = party.length - 4;
  const thresholds: Threshold[] = THREATS.map((t) => ({ name: t.name, xp: Math.max(0, t.budget + extra * t.perCharacter) }));
  const notes: string[] = [];
  if (new Set(party).size > 1) notes.push(`The characters' levels differ; party level ${level} is their average.`);
  let xp = 0;
  for (const foe of foes) {
    const diff = 'level' in foe ? foe.level - level : 0;
    if (diff < -4) notes.push('Creatures more than 4 levels below the party count as 0 XP.');
    if (diff > 4) notes.push('Creatures more than 4 levels above the party are beyond the chart; counted as 160 XP.');
    xp += diff < -4 ? 0 : (XP_BY_LEVEL_DIFFERENCE[Math.min(4, diff)] ?? 0);
  }
  return { rating: rate(xp, thresholds, 'Beyond Extreme'), xp, thresholds, source: 'Pathfinder GM Core, Encounter Design (ORC License)', notes: [...new Set(notes)] };
}
