/**
 * @file Compact HP display (current/max + temp), coloured by how hurt the
 * combatant is.
 */
import type { Combatant } from '../../domain/combat/types';

/** Green above half, orange at half or below, red at 0; "HP —" when untracked. */
export function HpSummary({ combatant: c }: { combatant: Combatant }) {
  if (c.currentHp === null || c.maxHp === null) {
    return <span className="hp muted" title="HP tracked by the player">HP —</span>;
  }
  const pct = c.maxHp > 0 ? c.currentHp / c.maxHp : 0;
  const tone = pct <= 0 ? 'out' : pct <= 0.5 ? 'bloodied' : 'healthy';
  return (
    <span className={`hp ${tone}`} title="Current / max HP">
      {c.currentHp}/{c.maxHp}
      {c.tempHp > 0 && <span className="temp-hp"> +{c.tempHp}</span>}
    </span>
  );
}
