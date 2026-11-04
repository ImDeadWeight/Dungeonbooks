/**
 * @file 5e difficulty, from SRD 5.2.1's Combat Encounters (CC-BY-4.0): each
 * character's level gives an XP budget for Low, Moderate and High, the
 * party's budget is their sum, and foes cost the XP for their CR (the same
 * table in SRD 5.1 and 5.2.1). Used for both 5e formats; the 2014 rules'
 * encounter thresholds aren't in the SRD 5.1.
 */
import { rate, type Difficulty, type Foe, type PartyLevels, type Threshold } from './types';

/** XP by challenge rating. */
export const XP_BY_CR: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

/** XP budget per character for Low, Moderate and High, by level 1–20. */
const BUDGET_PER_CHARACTER: [number, number, number][] = [
  [50, 75, 100],
  [100, 150, 200],
  [150, 225, 400],
  [250, 375, 500],
  [500, 750, 1100],
  [600, 1000, 1400],
  [750, 1300, 1700],
  [1000, 1700, 2100],
  [1300, 2000, 2600],
  [1600, 2300, 3100],
  [1900, 2900, 4100],
  [2200, 3700, 4700],
  [2600, 4200, 5400],
  [2900, 4900, 6200],
  [3300, 5400, 7800],
  [3800, 6100, 9800],
  [4500, 7200, 11700],
  [5000, 8700, 14200],
  [5500, 10700, 17200],
  [6400, 13200, 22000],
];

const STEPS = ['Low', 'Moderate', 'High'];

const clampLevel = (level: number) => Math.min(20, Math.max(1, Math.round(level)));

/** Rates 5e foes against the party's levels. */
export function rate5e(party: PartyLevels, foes: Foe[]): Difficulty | null {
  if (!party.length || !foes.length) return null;
  const thresholds: Threshold[] = STEPS.map((name, i) => ({
    name,
    xp: party.reduce((sum, level) => sum + BUDGET_PER_CHARACTER[clampLevel(level) - 1][i], 0),
  }));
  const notes: string[] = [];
  let xp = 0;
  for (const foe of foes) {
    const value = 'cr' in foe ? XP_BY_CR[foe.cr] : undefined;
    if (value === undefined) notes.push(`A foe without a known CR counts as 0 XP.`);
    xp += value ?? 0;
  }
  return { rating: rate(xp, thresholds, 'Beyond High'), xp, thresholds, source: 'SRD 5.2.1, Combat Encounters', notes: [...new Set(notes)] };
}
