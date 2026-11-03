/**
 * @file Dialog for creating a custom condition (name, effect, how it ends,
 * per-turn roll) and applying it.
 */
import { useState } from 'react';
import type { ConditionDef } from '../../domain/conditions';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { getFormat } from 'campaign-link/formats/registry';
import { sameContent } from '../../domain/transfer/plan';
import { conditionNameTaken, useCharacters } from '../../state/characterStore';
import { Modal } from '../common/Modal';
import { closeUnlessDirty } from '../common/unsavedChanges';
import { ConditionFields, emptyConditionValues, type ConditionValues } from '../conditions/ConditionFields';

/** Props for NewConditionDialog. */
interface Props {
  formatId: FormatId;
  initialName: string;
  onCreated(def: ConditionDef): void;
  onCancel(): void;
}

/** Custom conditions get rules text and a per-turn save default, like built-ins. */
export function NewConditionDialog({ formatId, initialName, onCreated, onCancel }: Props) {
  const customs = useCharacters((s) => s.customConditions);
  const [initial] = useState(() => emptyConditionValues(initialName));
  const [values, setValues] = useState<ConditionValues>(initial);
  const { name, ...details } = values;
  const nameError = name.trim() && conditionNameTaken(formatId, name, customs) ? `A condition called "${name.trim()}" already exists.` : undefined;

  const dirty = !sameContent(values, initial);
  const cancel = () => closeUnlessDirty(dirty, onCancel);

  // Save the custom condition to the library and hand it back to be applied.
  const create = () => {
    if (!name.trim() || nameError) return;
    onCreated(useCharacters.getState().ensureCustomCondition(formatId, name, details));
  };

  return (
    <Modal
      title="New condition"
      size="small"
      onClose={cancel}
      footer={
        <>
          <button onClick={cancel}>Cancel</button>
          <button className="primary" disabled={!name.trim() || !!nameError} onClick={create}>Create and add</button>
        </>
      }
    >
      <div className="condition-fields">
        <ConditionFields
          value={values}
          onChange={setValues}
          nameError={nameError}
          showValueOptions={getFormat(formatId).valuedConditions}
        />
      </div>
    </Modal>
  );
}
