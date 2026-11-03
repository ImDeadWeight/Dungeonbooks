/**
 * @file Main panel header: combat state icon, encounter name, round, and the
 * combat controls (Roll for Initiative / Next Turn, undo/redo, End Combat,
 * Reset, add characters).
 */
import { Redo2, Undo2, UserPlus } from 'lucide-react';
import { rollForInitiative } from '../../domain/combat/initiative';
import { endCombat, nextTurn, nextTurnBlockers, resetEncounter } from '../../domain/combat/turnFlow';
import type { Encounter } from '../../domain/library/types';
import { redoCombat, runCombatAction, runCombatBoundary, undoCombat, useHistoryLabels } from '../../state/combatStore';
import { useUi } from '../../state/uiStore';
import { useCombatRules } from '../../state/useCombatRules';
import { confirmThen } from '../common/ConfirmDialog';
import { CrossedSwordsIcon, SheathedSwordsIcon } from '../common/SwordIcons';

/** Header and controls for one encounter. */
export function EncounterHeader({ encounter }: { encounter: Encounter }) {
  const openModal = useUi((s) => s.openModal);
  const { undoLabel, redoLabel } = useHistoryLabels(encounter.id);
  const { active, round } = encounter.combat;
  const blockers = nextTurnBlockers(encounter, useCombatRules(encounter.formatId));

  // Start combat: NPCs roll, PCs are prompted.
  const roll = () => runCombatBoundary(encounter.id, (enc, rules) => rollForInitiative(enc, rules));
  // End combat after confirming.
  const end = () =>
    confirmThen('End combat? Initiative is cleared; HP and conditions are kept.', 'End combat', () =>
      runCombatBoundary(encounter.id, (enc) => endCombat(enc)),
    );
  // Restore full HP / clear conditions after confirming.
  const reset = () =>
    confirmThen('Reset the encounter? Everyone returns to full HP with no conditions.', 'Reset', () =>
      runCombatBoundary(encounter.id, (enc) => resetEncounter(enc)),
    );

  return (
    <div className="panel-header encounter-header">
      <span className="combat-state" title={active ? 'Combat active' : 'Combat inactive'}>
        {active ? <CrossedSwordsIcon size={26} /> : <SheathedSwordsIcon size={26} />}
      </span>
      <h2>{encounter.name}</h2>
      {active && round > 0 && <span className="round muted">Round {round}</span>}
      <span className="spacer" />
      <button className="icon" title="Add characters" onClick={() => openModal({ type: 'addToEncounter', encounterId: encounter.id })}>
        <UserPlus size={20} />
      </button>
      {active ? (
        <>
          <button className="icon" disabled={!undoLabel} title={undoLabel ? `Undo: ${undoLabel}` : 'Nothing to undo'} onClick={() => undoCombat(encounter.id)}>
            <Undo2 size={20} />
          </button>
          <button className="icon" disabled={!redoLabel} title={redoLabel ? `Redo: ${redoLabel}` : 'Nothing to redo'} onClick={() => redoCombat(encounter.id)}>
            <Redo2 size={20} />
          </button>
          <button onClick={end}>End Combat</button>
          <button
            className="primary big"
            disabled={blockers.length > 0}
            title={blockers.join('\n')}
            onClick={() => runCombatAction(encounter.id, 'Next turn', (enc, rules) => nextTurn(enc, rules))}
          >
            Next Turn
          </button>
        </>
      ) : (
        <>
          <button onClick={reset}>Reset</button>
          <button className="primary big" disabled={encounter.combatants.length === 0} onClick={roll}>
            Roll for Initiative
          </button>
        </>
      )}
    </div>
  );
}

/** Orange banner explaining why Next Turn is disabled. */
export function TurnBlockers({ encounter }: { encounter: Encounter }) {
  const rules = useCombatRules(encounter.formatId);
  if (!encounter.combat.active || encounter.combat.currentId === null) return null;
  const blockers = nextTurnBlockers(encounter, rules);
  if (blockers.length === 0) return null;
  return <div className="turn-blockers">{blockers.join(' · ')}</div>;
}
