/**
 * @file The fields of a condition (name, what it does, how it ends, force
 * resolve, and for formats with valued conditions: has a value, drops each
 * turn), shared by the condition editor and the in-combat New condition
 * dialog.
 */
import './conditions.css';

/** The editable parts of a condition. */
export interface ConditionValues {
  name: string;
  effect: string;
  endsWhen: string;
  repeatsSave: boolean;
  valued: boolean;
  dropsEachTurn: boolean;
}

/** A blank condition, optionally with a name. */
export function emptyConditionValues(name = ''): ConditionValues {
  return { name, effect: '', endsWhen: '', repeatsSave: false, valued: false, dropsEachTurn: false };
}

/** Props for ConditionFields. */
interface Props {
  value: ConditionValues;
  onChange(next: ConditionValues): void;
  /** The format's conditions can carry a number (PF2e): show the value options. */
  showValueOptions: boolean;
  /** Shown under the name, e.g. when another condition already uses it. */
  nameError?: string;
}

/** Name, rules text, the force-resolve default and (valued formats) the value options. */
export function ConditionFields({ value, onChange, nameError, showValueOptions }: Props) {
  // Merge a partial change.
  const set = (p: Partial<ConditionValues>) => onChange({ ...value, ...p });
  return (
    <>
      <label className="field">
        Name
        <input autoFocus value={value.name} onChange={(e) => set({ name: e.target.value })} />
        {nameError && <span className="field-error">{nameError}</span>}
      </label>
      <label className="field">
        What it does
        <textarea rows={3} placeholder="Loses 1d4 HP at the start of each turn." value={value.effect} onChange={(e) => set({ effect: e.target.value })} />
      </label>
      <label className="field">
        How it ends
        <input placeholder="A DC 10 Medicine check or any healing stops it." value={value.endsWhen} onChange={(e) => set({ endsWhen: e.target.value })} />
      </label>
      <label className="inline">
        <input type="checkbox" checked={value.repeatsSave} onChange={(e) => set({ repeatsSave: e.target.checked })} />
        Force resolve each turn (must be resolved before Next Turn)
      </label>
      {showValueOptions && (
        <>
          <label className="inline">
            <input
              type="checkbox"
              checked={value.valued}
              onChange={(e) => set({ valued: e.target.checked, dropsEachTurn: e.target.checked && value.dropsEachTurn })}
            />
            Has a value (e.g. Frightened 2)
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={value.dropsEachTurn}
              disabled={!value.valued}
              onChange={(e) => set({ dropsEachTurn: e.target.checked })}
            />
            Value drops by 1 at the end of the creature's turn
          </label>
        </>
      )}
    </>
  );
}
