/**
 * @file Create-campaign and create-area forms, and the campaign format field.
 */
import { useState } from 'react';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { FORMAT_LIST } from 'campaign-link/formats/registry';
import type { Id } from '../../domain/ids';
import { useLibrary } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';
import { Select } from 'campaign-link/ui/common/Select';
import { useReportDirty } from '../common/unsavedChanges';
import { ParentPicker } from './ParentPicker';

// Select values must be strings; '' stands for "no default format".
const NO_FORMAT = '';

/** Campaign's default format for new encounters and characters; also used by the Edit campaign dialog. */
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

/** Name box, format dropdown and Create Campaign button. */
export function CampaignForm({ onDirtyChange }: { onDirtyChange(dirty: boolean): void }) {
  const [name, setName] = useState('');
  const [formatId, setFormatId] = useState<FormatId | null>(null);
  useReportDirty(name !== '' || formatId !== null, onDirtyChange);
  // Create it (when valid) and close the dialog.
  const create = () => {
    if (!name.trim()) return;
    useLibrary.getState().addCampaign(name.trim(), formatId);
    useUi.getState().closeModal();
  };
  return (
    <div className="create-fields">
      <label className="field grow">
        Campaign name
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
      </label>
      <CampaignFormatField value={formatId} onChange={setFormatId} />
      <button className="primary" disabled={!name.trim()} onClick={create}>Create Campaign</button>
    </div>
  );
}

/** Name box, campaign and parent-area dropdowns, and Create Area button. */
export function AreaForm({ campaignId: initialCampaign, parentAreaId: initialParent, onDirtyChange }: {
  campaignId: Id | null;
  parentAreaId: Id | null;
  onDirtyChange(dirty: boolean): void;
}) {
  const [name, setName] = useState('');
  const [parents, setParents] = useState({ campaignId: initialCampaign, areaId: initialParent });
  useReportDirty(name !== '' || parents.campaignId !== initialCampaign || parents.areaId !== initialParent, onDirtyChange);
  const valid = !!name.trim() && !!parents.campaignId;
  // Create it (when valid) and close the dialog.
  const create = () => {
    if (!valid || !parents.campaignId) return;
    useLibrary.getState().addArea(name.trim(), parents.campaignId, parents.areaId);
    useUi.getState().closeModal();
  };
  return (
    <div className="create-fields">
      <label className="field grow">
        Area name
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
      </label>
      <ParentPicker {...parents} requireCampaign showArea areaLabel="Inside area" onChange={setParents} />
      <button className="primary" disabled={!valid} onClick={create}>Create Area</button>
    </div>
  );
}
