/**
 * @file Campaign (and optionally area) dropdowns for choosing where something
 * lives.
 */
import { useMemo } from 'react';
import type { Id } from '../../domain/ids';
import { flattenAreas } from '../../domain/library/tree';
import { useLibrary } from '../../state/libraryStore';
import { Select } from 'campaign-link/ui/common/Select';

/** Props for ParentPicker. */
interface Props {
  campaignId: Id | null;
  areaId: Id | null;
  /** Areas must belong to a campaign; encounters may be unfiled. */
  requireCampaign: boolean;
  showArea: boolean;
  /** Label for the area dropdown (default "Area"). */
  areaLabel?: string;
  /** Areas that can't be picked, e.g. an area being moved and everything inside it. */
  excludeAreaIds?: Set<Id>;
  onChange(next: { campaignId: Id | null; areaId: Id | null }): void;
}

// Select values must be strings; '' stands for "none".
const NONE = '';

/** Campaign dropdown, plus an area dropdown (nested areas shown as "Prison › Mines") for the chosen campaign when showArea is set. */
export function ParentPicker({ campaignId, areaId, requireCampaign, showArea, areaLabel = 'Area', excludeAreaIds, onChange }: Props) {
  const campaigns = useLibrary((s) => s.campaigns);
  const allAreas = useLibrary((s) => s.areas);
  const areas = useMemo(
    () => (campaignId ? flattenAreas({ areas: allAreas }, campaignId).filter((x) => !excludeAreaIds?.has(x.area.id)) : []),
    [allAreas, campaignId, excludeAreaIds],
  );
  // "None (unfiled)" is only offered when a campaign isn't required.
  const campaignOptions = [
    ...(requireCampaign ? [] : [{ value: NONE, label: 'None (unfiled)' }]),
    ...campaigns.map((c) => ({ value: c.id, label: c.name })),
  ];
  return (
    <>
      <label className="field">
        Campaign
        <Select
          value={campaignId ?? NONE}
          placeholder="Select…"
          options={campaignOptions}
          onChange={(v) => onChange({ campaignId: v || null, areaId: null })}
        />
      </label>
      {showArea && campaignId && (
        <label className="field">
          {areaLabel}
          <Select
            value={areaId ?? NONE}
            options={[{ value: NONE, label: 'None (directly in campaign)' }, ...areas.map((x) => ({ value: x.area.id, label: x.path }))]}
            onChange={(v) => onChange({ campaignId, areaId: v || null })}
          />
        </label>
      )}
    </>
  );
}
