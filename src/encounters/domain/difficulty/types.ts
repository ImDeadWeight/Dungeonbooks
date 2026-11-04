/**
 * @file Encounter difficulty: how a fight's foes measure against the party,
 * by the format's own encounter-building rules. Formats without such rules
 * (B/X, PF1e, 3.5e) have none.
 */

/** The party's characters, by level (one entry per character). */
export type PartyLevels = number[];

/** A foe for difficulty: its challenge rating (5e, "1/4") or level (PF2e). */
export type Foe = { cr: string } | { level: number };

/** One step of the format's difficulty scale, and the XP it allows this party. */
export interface Threshold {
  name: string;
  xp: number;
}

/** How hard an encounter is. */
export interface Difficulty {
  /** The step the foes' XP reaches ("Moderate"), or the scale's "beyond" label past the last step. */
  rating: string;
  /** The foes' XP, as the format counts it. */
  xp: number;
  /** The scale for this party, easiest first. */
  thresholds: Threshold[];
  /** Where the rules come from, for the tooltip. */
  source: string;
  /** Anything that makes the figure less exact (a foe off the chart). */
  notes: string[];
}

/** Rates a fight for a party, or null when either side is empty. */
export type RateEncounter = (party: PartyLevels, foes: Foe[]) => Difficulty | null;

/** The rating for `xp` on a scale: the first step it fits within, else `beyond`. */
export function rate(xp: number, thresholds: Threshold[], beyond: string): string {
  return thresholds.find((t) => xp <= t.xp)?.name ?? beyond;
}
