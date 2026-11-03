/**
 * @file How an encounter from the linked Encounters campaign is described:
 * whether its combat is running (and which round) or not, and the condition
 * of a character in it.
 */
import type { CombatantStatus, LinkEncounter } from 'campaign-link';
import './encounters.css';

/** "In combat · round 3" while combat runs, otherwise "Not in combat". */
export function EncounterStateBadge({ encounter }: { encounter: LinkEncounter }) {
  return encounter.inCombat ? (
    <span className="encounter-state live">In combat · round {Math.max(1, encounter.round)}</span>
  ) : (
    <span className="encounter-state">Not in combat</span>
  );
}

/** Words for a combatant's condition; null while it's fine. */
export function statusWords(status: CombatantStatus): string | null {
  switch (status) {
    case 'dying':
      return 'dying';
    case 'stable':
      return 'stable';
    case 'dead':
      return 'dead';
    case 'active':
      return null;
  }
}
