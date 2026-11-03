/**
 * @file Import conflicts: each item that exists with different content gets Keep
 * mine / Use imported / Keep both.
 */
import type { PlanItem, Resolution } from '../../domain/transfer/plan';
import { Select } from 'campaign-link/ui/common/Select';

/** The three resolutions with button labels and tooltips. */
const CHOICES: { value: Resolution; label: string; title: string }[] = [
  { value: 'mine', label: 'Keep mine', title: 'Leave your version unchanged' },
  { value: 'theirs', label: 'Use imported', title: 'Replace your version with the one in the file' },
  { value: 'both', label: 'Keep both', title: 'Add the imported version as a copy' },
];

/** Chip label for each item type. */
const TYPE_LABEL: Record<PlanItem['type'], string> = {
  campaign: 'Campaign',
  area: 'Area',
  encounter: 'Encounter',
  character: 'Character',
};

/** Props for ConflictList. */
interface Props {
  conflicts: PlanItem[];
  resolutions: Record<string, Resolution>;
  onChange(next: Record<string, Resolution>): void;
}

/** Conflict rows plus an "Apply to all" dropdown; renders nothing without conflicts. */
export function ConflictList({ conflicts, resolutions, onChange }: Props) {
  if (conflicts.length === 0) return null;
  // Apply one resolution to every listed conflict.
  const setAll = (r: Resolution) => onChange({ ...resolutions, ...Object.fromEntries(conflicts.map((c) => [c.key, r])) });

  return (
    <section className="import-section">
      <div className="row">
        <h3 className="spacer">
          {conflicts.length} already {conflicts.length === 1 ? 'exists' : 'exist'} with different content
        </h3>
        <span className="muted">Apply to all</span>
        <Select<Resolution | ''>
          value=""
          placeholder="Choose…"
          options={CHOICES.map((c) => ({ value: c.value, label: c.label }))}
          onChange={(r) => r && setAll(r)}
        />
      </div>
      {conflicts.map((c) => (
        <div key={c.key} className="conflict-row">
          <span className="chip">{TYPE_LABEL[c.type]}</span>
          <span className="spacer">{c.name}</span>
          <div className="segmented" role="radiogroup" aria-label={`Resolve ${c.name}`}>
            {CHOICES.map((choice) => (
              <button
                key={choice.value}
                role="radio"
                aria-checked={(resolutions[c.key] ?? 'mine') === choice.value}
                className={(resolutions[c.key] ?? 'mine') === choice.value ? 'on' : ''}
                title={choice.title}
                onClick={() => onChange({ ...resolutions, [c.key]: choice.value })}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
