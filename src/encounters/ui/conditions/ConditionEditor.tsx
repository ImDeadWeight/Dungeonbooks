/**
 * @file Create/edit window for a custom condition: format, name, rules text,
 * the force-resolve default and (valued formats) the value options.
 */
import { useState } from 'react';
import type { CustomCondition } from '../../domain/conditions';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { FORMAT_LIST, getFormat } from 'campaign-link/formats/registry';
import { newId, type Id } from '../../domain/ids';
import { conditionNameTaken, useCharacters } from '../../state/characterStore';
import { useLibrary } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';
import { Modal } from '../common/Modal';
import { Select } from 'campaign-link/ui/common/Select';
import { sameContent } from '../../domain/transfer/plan';
import { closeUnlessDirty } from '../common/unsavedChanges';
import { ConditionFields, emptyConditionValues, type ConditionValues } from './ConditionFields';

/** Fields of an existing condition, or a blank one. */
function toValues(c: CustomCondition | undefined): ConditionValues {
  if (!c) return emptyConditionValues();
  return {
    name: c.name,
    effect: c.effect,
    endsWhen: c.endsWhen,
    repeatsSave: c.repeatsSave,
    valued: !!c.valued,
    dropsEachTurn: !!c.dropsEachTurn,
  };
}

/** Create a custom condition (conditionId null) or edit one. */
export function ConditionEditor({ conditionId }: { conditionId: Id | null }) {
  const customs = useCharacters((s) => s.customConditions);
  const existing = customs.find((c) => c.id === conditionId);
  const closeModal = useUi((s) => s.closeModal);
  const [initial] = useState(() => ({ ...toValues(existing), formatId: existing?.formatId ?? FORMAT_LIST[0].id }));
  const [values, setValues] = useState<ConditionValues>(initial);
  const [formatId, setFormatId] = useState<FormatId>(initial.formatId);

  const dirty = !sameContent({ ...values, formatId }, initial);
  const cancel = () => closeUnlessDirty(dirty, closeModal);
  const name = values.name.trim();
  const nameError =
    name && conditionNameTaken(formatId, name, customs, existing?.id)
      ? `${getFormat(formatId).name} already has a condition called "${name}".`
      : undefined;
  const valid = !!name && !nameError;

  // Store the condition; a rename also updates the name where it's already applied.
  const save = () => {
    if (!valid) return;
    const cond: CustomCondition = {
      id: existing?.id ?? newId(),
      formatId,
      name,
      effect: values.effect.trim(),
      endsWhen: values.endsWhen.trim(),
      repeatsSave: values.repeatsSave,
      // Value options only exist in formats with valued conditions.
      ...(getFormat(formatId).valuedConditions && { valued: values.valued, dropsEachTurn: values.valued && values.dropsEachTurn }),
    };
    useCharacters.getState().saveCustomCondition(cond);
    if (existing && existing.name !== name) useLibrary.getState().renameAppliedCondition(cond.id, name);
    closeModal();
  };

  return (
    <Modal
      title={existing ? 'Edit condition' : 'New condition'}
      size="small"
      onClose={cancel}
      footer={
        <>
          <button onClick={cancel}>Cancel</button>
          <button className="primary" disabled={!valid} onClick={save}>Save condition</button>
        </>
      }
    >
      <div className="condition-fields">
        <label className="field">
          Format
          {existing ? (
            // Locked once created: characters of this format may already have it.
            <input value={getFormat(formatId).name} disabled />
          ) : (
            <Select<FormatId> value={formatId} options={FORMAT_LIST.map((f) => ({ value: f.id, label: f.name }))} onChange={setFormatId} />
          )}
        </label>
        <ConditionFields
          value={values}
          onChange={setValues}
          nameError={nameError}
          showValueOptions={getFormat(formatId).valuedConditions}
        />
        {existing && (
          <p className="muted">
            Text changes show everywhere straight away. Force resolve and the value options are defaults for new
            applications; characters that already have this condition keep their own settings.
          </p>
        )}
      </div>
    </Modal>
  );
}
