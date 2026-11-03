/**
 * @file The Health section: Damage / Heal / Temp HP for tracked HP, or Drop /
 * Revive when the player tracks HP.
 */
import { useState } from 'react';
import { applyDamage, applyHealing, setTempHp } from '../../domain/combat/health';
import type { CombatRules } from '../../domain/combat/rules';
import { dropCombatant, reviveCombatant } from '../../domain/combat/status';
import type { Combatant } from '../../domain/combat/types';
import type { Id } from '../../domain/ids';
import type { Encounter } from '../../domain/library/types';
import { runCombatAction } from '../../state/combatStore';
import { HpSummary } from '../encounter/HpSummary';

/** Props for the health trackers. */
interface Props {
  encounterId: Id;
  combatant: Combatant;
}

/** No tracked HP (the player tracks it): the DM drops or revives them manually. */
function UntrackedHealth({ encounterId, combatant: c }: Props) {
  return (
    <div className="tracker">
      <div className="tracker-title">
        <h4>Health</h4>
        <span className="muted">Tracked by the player</span>
      </div>
      {c.status === 'active' && (
        <button
          className="damage"
          title="The character is at 0 HP"
          onClick={() => runCombatAction(encounterId, `${c.name} dropped`, (enc, rules) => dropCombatant(enc, c.id, rules))}
        >
          Drop
        </button>
      )}
      {c.status === 'dying' && (
        <button
          className="heal"
          title="The character has been healed above 0 HP"
          onClick={() => runCombatAction(encounterId, `${c.name} revived`, (enc, rules) => reviveCombatant(enc, c.id, rules))}
        >
          Revive
        </button>
      )}
    </div>
  );
}

/** Amount box with Damage, Heal and Temp buttons; falls back to Drop/Revive for untracked HP. */
export function HealthTracker({ encounterId, combatant: c }: Props) {
  const [amount, setAmount] = useState('');
  if (c.currentHp === null) return <UntrackedHealth encounterId={encounterId} combatant={c} />;

  const value = Number.parseInt(amount, 10);
  const valid = Number.isFinite(value) && value > 0;
  // Apply the typed amount with the given action, then clear the box.
  const apply = (label: string, fn: (enc: Encounter, id: Id, amount: number, rules: CombatRules) => Encounter) => {
    if (!valid) return;
    runCombatAction(encounterId, `${c.name}: ${label} ${value}`, (enc, rules) => fn(enc, c.id, value, rules));
    setAmount('');
  };

  return (
    <div className="tracker">
      <div className="tracker-title">
        <h4>Health</h4>
        <HpSummary combatant={c} />
      </div>
      <div className="row">
        <input
          type="number"
          min={1}
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button className="damage" disabled={!valid} onClick={() => apply('damage', applyDamage)}>
          Damage
        </button>
        <button className="heal" disabled={!valid} onClick={() => apply('healing', applyHealing)}>
          Heal
        </button>
        <button disabled={!valid} title="Set temporary HP" onClick={() => apply('temp HP', setTempHp)}>
          Temp
        </button>
      </div>
    </div>
  );
}
