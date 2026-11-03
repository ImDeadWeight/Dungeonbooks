/**
 * @file Dialog for entering initiative for PCs at combat start and for anyone
 * added mid-combat.
 */
import { Dices } from 'lucide-react';
import { useState } from 'react';
import { awaitingInitiative, setInitiative } from '../../domain/combat/initiative';
import { endCombat } from '../../domain/combat/turnFlow';
import { rollDie, formatModifier } from 'campaign-link/formats/dice';
import type { Encounter } from '../../domain/library/types';
import { runCombatAction, runCombatBoundary } from '../../state/combatStore';
import { useCombatRules } from '../../state/useCombatRules';
import { Modal } from '../common/Modal';

/**
 * Shown whenever an active combat has combatants without initiative: PCs
 * after Roll for Initiative, and anyone added mid-combat.
 */
export function InitiativePrompt({ encounter }: { encounter: Encounter }) {
  const rules = useCombatRules(encounter.formatId);
  const pending = awaitingInitiative(encounter);
  const [values, setValues] = useState<Record<string, string>>({});
  const starting = encounter.combat.currentId === null;

  // Entered values as numbers (NaN until filled).
  const parsed = Object.fromEntries(
    pending.map((c) => [c.id, Number.parseInt(values[c.id] ?? '', 10)] as const),
  );
  const complete = pending.every((c) => Number.isFinite(parsed[c.id]));

  // Apply all values once every box is filled.
  const submit = () => {
    if (!complete) return;
    runCombatAction(encounter.id, 'Enter initiative', (enc, r) => setInitiative(enc, parsed, r));
  };

  // Starting combat can be backed out of; a mid-combat addition must be given a slot.
  const cancel = starting ? () => runCombatBoundary(encounter.id, (enc) => endCombat(enc)) : undefined;

  return (
    <Modal
      title="Enter initiative"
      size="small"
      onClose={cancel ?? (() => undefined)}
      footer={
        <>
          {cancel && <button onClick={cancel}>Cancel combat</button>}
          <button className="primary" disabled={!complete} onClick={submit}>
            {starting ? 'Start combat' : 'Add to order'}
          </button>
        </>
      }
    >
      <form
        className="initiative-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {pending.map((c, i) => {
          const mod = rules.initiativeModifier(c.templateId);
          return (
            <div key={c.id} className="row">
              <span className="spacer">{c.name}</span>
              <span className="muted" title="Initiative modifier">{formatModifier(mod)}</span>
              <input
                type="number"
                autoFocus={i === 0}
                value={values[c.id] ?? ''}
                onChange={(e) => setValues({ ...values, [c.id]: e.target.value })}
              />
              <button
                type="button"
                className="icon"
                title={`Roll d${rules.initiativeDie} + modifier`}
                onClick={() => setValues({ ...values, [c.id]: String(rollDie(rules.initiativeDie) + mod) })}
              >
                <Dices size={18} />
              </button>
            </div>
          );
        })}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
