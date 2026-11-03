/**
 * @file One row of the initiative list: initiative, name, token, conditions,
 * dying status, HP, and inline dying roll buttons on their turn.
 */
import { Trash2 } from 'lucide-react';
import { sideOf } from '../../domain/combat/initiative';
import { removeCombatant } from '../../domain/combat/status';
import type { Combatant } from '../../domain/combat/types';
import { conditionLabel } from '../../domain/conditions';
import type { Encounter } from '../../domain/library/types';
import { useLibrary } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';
import { useCombatRules } from '../../state/useCombatRules';
import { confirmThen } from '../common/ConfirmDialog';
import { DyingButtons, dyingLabel, DyingTally } from './DyingControls';
import { HpSummary } from './HpSummary';

/** Props for CombatantRow. */
interface Props {
  encounter: Encounter;
  combatant: Combatant;
}

/** Click selects the combatant; highlights whose turn it is. */
export function CombatantRow({ encounter, combatant: c }: Props) {
  const selected = useUi((s) => s.selectedCombatant[encounter.id] === c.id);
  const selectCombatant = useUi((s) => s.selectCombatant);
  const openCombatant = useUi((s) => s.openCombatant);
  const rules = useCombatRules(encounter.formatId);
  const isTurn = encounter.combat.currentId === c.id;
  const dying = c.status === 'dying';

  // Remove from the encounter after confirming (outside combat only).
  const onDelete = () =>
    confirmThen(`Remove ${c.name} from this encounter?`, 'Remove', () =>
      useLibrary.getState().replaceEncounter(removeCombatant(encounter, c.id)),
    );

  return (
    <div
      className={`combatant-row${selected ? ' selected' : ''}${isTurn ? ' current' : ''}${dying ? ' dying' : ''}`}
      // Tapping the row opens the combatant (on a phone, its panel); buttons in the row (dying rolls) only select it.
      onClick={(e) =>
        e.target instanceof Element && e.target.closest('button') ? selectCombatant(encounter.id, c.id) : openCombatant(encounter.id, c.id)
      }
    >
      <div className="combatant-main">
        <span
          className={`initiative${c.initiative === null ? ' unset' : ''}`}
          title={c.initiative === null ? 'No initiative yet' : `Initiative ${c.initiative}`}
        >
          <span className="initiative-label">Init</span>
          <span className="initiative-value">{c.initiative ?? '—'}</span>
        </span>
        <div className="combatant-name">
          <strong>{c.name}</strong>
          {c.tokenDescription && <span className="token muted">{c.tokenDescription}</span>}
          {rules.initiativeMode === 'sides' && <span className="token muted">{sideOf(c, rules)}</span>}
        </div>
        <div className="combatant-conditions">
          {c.conditions.map((cond) => (
            <span
              key={cond.instanceId}
              className={`chip${isTurn && cond.requiresResolve && !cond.resolvedThisTurn ? ' unresolved' : ''}`}
              title={cond.requiresResolve ? 'Save each turn' : undefined}
            >
              {conditionLabel(cond)}
            </span>
          ))}
        </div>
        {dying && (
          <span className="status-badge dying">
            {dyingLabel(rules)} <DyingTally combatant={c} rules={rules} />
          </span>
        )}
        <HpSummary combatant={c} />
        {!encounter.combat.active && (
          <button className="icon" title="Remove from encounter" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {isTurn && dying && <DyingButtons encounterId={encounter.id} combatant={c} rules={rules} />}
    </div>
  );
}
