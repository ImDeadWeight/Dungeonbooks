/**
 * @file One applied condition in the right panel: value controls (valued
 * conditions), save-each-turn toggle, Resolve button, remove button, and
 * rules text.
 */
import { Minus, Plus, Trash2 } from 'lucide-react';
import { removeCondition, resolveCondition, setConditionValue, setRequiresResolve } from '../../domain/combat/conditions';
import {
  conditionLabel,
  MAX_CONDITION_VALUE,
  REPEAT_SAVE_HINT,
  type ActiveCondition,
  type ConditionDef,
} from '../../domain/conditions';
import type { Id } from '../../domain/ids';
import { runCombatAction } from '../../state/combatStore';

/** Props for ConditionRow. */
interface Props {
  encounterId: Id;
  combatantId: Id;
  combatantName: string;
  condition: ActiveCondition;
  /** Missing when a custom condition was deleted after being applied. */
  def?: ConditionDef;
  isTheirTurn: boolean;
}

/**
 * One applied condition: what it does, and either the per-turn roll to
 * resolve or how it ends. Only per-turn ones get the Resolve button.
 */
export function ConditionRow({ encounterId, combatantId, combatantName, condition: cond, def, isTheirTurn }: Props) {
  // Run a combat action labelled with the combatant's name (for undo).
  const run = (label: string, fn: Parameters<typeof runCombatAction>[2]) =>
    runCombatAction(encounterId, `${combatantName}: ${label}`, fn);
  // Valued conditions: the number, and changing it (0 removes the condition).
  const value = cond.value;
  const setValue = (to: number) =>
    run(to > 0 ? conditionLabel({ ...cond, value: to }) : `removed ${cond.name}`, (enc) =>
      setConditionValue(enc, combatantId, cond.instanceId, to),
    );
  // It's their turn and this condition still needs its roll.
  const needsResolve = isTheirTurn && cond.requiresResolve && !cond.resolvedThisTurn;

  return (
    <div className={`condition${needsResolve ? ' pending' : ''}`}>
      <div className="condition-row">
        <strong className="spacer">{cond.name}</strong>
        {value !== null && (
          <span className="condition-value">
            <button
              className="icon"
              title={value === 1 ? `Remove ${cond.name}` : `Lower to ${cond.name} ${value - 1}`}
              onClick={() => setValue(value - 1)}
            >
              <Minus size={14} />
            </button>
            <strong title={cond.dropsEachTurn ? 'Drops by 1 at the end of their turn' : undefined}>{value}</strong>
            <button
              className="icon"
              title={`Raise to ${cond.name} ${value + 1}`}
              disabled={value >= MAX_CONDITION_VALUE}
              onClick={() => setValue(value + 1)}
            >
              <Plus size={14} />
            </button>
          </span>
        )}
        <label className="inline save-toggle" title="Does the effect that applied it allow a new roll each turn?">
          <input
            type="checkbox"
            checked={cond.requiresResolve}
            onChange={(e) =>
              run(`${cond.name} ${e.target.checked ? 'saves' : 'no longer saves'} each turn`, (enc) =>
                setRequiresResolve(enc, combatantId, cond.instanceId, e.target.checked),
              )
            }
          />
          Save each turn
        </label>
        {needsResolve && (
          <button className="resolve" onClick={() => run(`resolved ${cond.name}`, (enc) => resolveCondition(enc, combatantId, cond.instanceId))}>
            Resolve
          </button>
        )}
        {isTheirTurn && cond.requiresResolve && cond.resolvedThisTurn && <span className="muted">Resolved</span>}
        <button
          className="icon"
          title={`Remove ${cond.name}`}
          onClick={() => run(`removed ${cond.name}`, (enc) => removeCondition(enc, combatantId, cond.instanceId))}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {cond.requiresResolve && <p className="condition-resolve">{REPEAT_SAVE_HINT}</p>}
      {def?.effect && <p className="condition-effect">{def.effect}</p>}
      {def?.endsWhen && <p className="condition-ends">Ends: {def.endsWhen}</p>}
      {cond.dropsEachTurn && <p className="condition-ends">Drops by 1 at the end of each of their turns.</p>}
    </div>
  );
}
