/**
 * @file A campaign's default format: the game system its new encounters, and
 * the characters made for them, start with.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import { FORMAT_LIST } from 'campaign-link/formats/registry';
import { Select } from 'campaign-link/ui/common/Select';

// Select values must be strings; '' stands for "no default format".
const NO_FORMAT = '';

/** Default format dropdown, with None. */
export function CampaignFormatField({ value, onChange }: { value: FormatId | null; onChange(v: FormatId | null): void }) {
  return (
    <label className="field" title="New encounters in this campaign, and new characters created for them, start with this format">
      Default format
      <Select<FormatId | ''>
        value={value ?? NO_FORMAT}
        options={[{ value: NO_FORMAT, label: 'None' }, ...FORMAT_LIST.map((f) => ({ value: f.id, label: f.name }))]}
        onChange={(v) => onChange(v || null)}
      />
    </label>
  );
}
