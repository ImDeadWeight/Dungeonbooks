/**
 * @file Labelled dropdown for picking a game format, shared by the encounter
 * forms.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import { FORMAT_LIST } from 'campaign-link/formats/registry';
import { Select } from 'campaign-link/ui/common/Select';

/** Props for FormatField. '' means nothing picked yet. */
interface Props {
  value: FormatId | '';
  onChange(formatId: FormatId): void;
  disabled?: boolean;
  title?: string;
}

/** "Format" label over a dropdown of every format. */
export function FormatField({ value, onChange, disabled, title }: Props) {
  return (
    <label className="field" title={title}>
      Format
      <Select<FormatId | ''>
        value={value}
        placeholder="Select…"
        disabled={disabled}
        options={FORMAT_LIST.map((f) => ({ value: f.id, label: f.name }))}
        onChange={(v) => v && onChange(v)}
      />
    </label>
  );
}
