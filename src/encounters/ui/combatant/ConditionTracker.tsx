/**
 * @file The Conditions section: applied conditions plus a searchable picker to
 * add, remove, create and delete conditions.
 */
import { useState } from 'react';
import { addCondition, removeConditionType } from '../../domain/combat/conditions';
import type { Combatant } from '../../domain/combat/types';
import type { ConditionDef } from '../../domain/conditions';
import type { FormatId } from 'campaign-link/formats/formatIds';
import type { Id } from '../../domain/ids';
import { conditionsFor, useCharacters } from '../../state/characterStore';
import { runCombatAction } from '../../state/combatStore';
import { confirmThen } from '../common/ConfirmDialog';
import { SearchPicker } from '../common/SearchPicker';
import { ConditionRow } from './ConditionRow';
import { NewConditionDialog } from './NewConditionDialog';

/** Props for ConditionTracker. */
interface Props {
  encounterId: Id;
  combatant: Combatant;
  formatId: FormatId;
  isTheirTurn: boolean;
}

/** Applied conditions and the condition picker for one combatant. */
export function ConditionTracker({ encounterId, combatant: c, formatId, isTheirTurn }: Props) {
  const custom = useCharacters((s) => s.customConditions);
  const defs = conditionsFor(formatId, custom);
  const customIds = new Set(custom.map((x) => x.id));
  const [creating, setCreating] = useState<string | null>(null);
  const appliedIds = c.conditions.map((x) => x.conditionId);

  // Apply a condition (logged for undo).
  const add = (def: ConditionDef) =>
    runCombatAction(encounterId, `${c.name}: ${def.name}`, (enc) => addCondition(enc, c.id, def));

  // Checked in the picker = on the character; unchecking removes it.
  const toggle = (def: ConditionDef) =>
    appliedIds.includes(def.id)
      ? runCombatAction(encounterId, `${c.name}: removed ${def.name}`, (enc) => removeConditionType(enc, c.id, def.id))
      : add(def);

  // Delete a custom condition from the library after confirming.
  const deleteCustom = (def: ConditionDef) =>
    confirmThen(
      `Delete the custom condition "${def.name}"? Characters that already have it keep it until it's removed.`,
      'Delete condition',
      () => useCharacters.getState().deleteCustomCondition(def.id),
    );

  return (
    <div className="tracker">
      <div className="tracker-title">
        <h4>Conditions</h4>
      </div>
      {c.conditions.map((cond) => (
        <ConditionRow
          key={cond.instanceId}
          encounterId={encounterId}
          combatantId={c.id}
          combatantName={c.name}
          condition={cond}
          def={defs.find((d) => d.id === cond.conditionId)}
          isTheirTurn={isTheirTurn}
        />
      ))}
      <SearchPicker
        items={defs.map((d) => ({ ...d, deletable: customIds.has(d.id) }))}
        selectedIds={appliedIds}
        onToggle={toggle}
        onCreate={setCreating}
        onDelete={deleteCustom}
        placeholder="Search or add a condition"
        emptyText="No conditions match."
        deleteTitle={(d) => `Delete the custom condition "${d.name}"`}
      />
      {creating !== null && (
        <NewConditionDialog
          formatId={formatId}
          initialName={creating}
          onCancel={() => setCreating(null)}
          onCreated={(def) => {
            setCreating(null);
            add(def);
          }}
        />
      )}
    </div>
  );
}
