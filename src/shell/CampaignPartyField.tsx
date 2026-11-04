/**
 * @file A campaign's usual party (how many characters, at what level): the
 * Encounters tab rates encounters against it until PCs are added to them.
 */
import { NumberInput } from 'campaign-link/ui/common/fields';
import type { PartySize } from '../campaigns/types';

/** A default for when the party is first switched on. */
const STARTING_PARTY: PartySize = { size: 4, level: 1 };

export function CampaignPartyField({ value, onChange }: { value: PartySize | null; onChange(v: PartySize | null): void }) {
  return (
    <div className="field campaign-party" title="Encounters without PCs are rated for this party">
      <label className="inline">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked ? STARTING_PARTY : null)} />
        Usual party, for rating encounters without PCs
      </label>
      {value && (
        <span className="row">
          <NumberInput value={value.size} min={1} max={20} onChange={(size) => onChange({ ...value, size })} />
          <span className="muted">characters at level</span>
          <NumberInput value={value.level} min={-1} max={30} onChange={(level) => onChange({ ...value, level })} />
        </span>
      )}
    </div>
  );
}
