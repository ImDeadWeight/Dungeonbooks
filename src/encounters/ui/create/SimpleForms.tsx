/**
 * @file Create-area form.
 */
import { useState } from 'react';
import type { Id } from '../../domain/ids';
import { useLibrary } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';
import { useReportDirty } from '../common/unsavedChanges';
import { ParentPicker } from './ParentPicker';

/** Name box, campaign and parent-area dropdowns, and Create Area button. */
export function AreaForm({ campaignId: initialCampaign, parentAreaId: initialParent, onDirtyChange }: {
  campaignId: Id;
  parentAreaId: Id | null;
  onDirtyChange(dirty: boolean): void;
}) {
  const [name, setName] = useState('');
  const [parents, setParents] = useState({ campaignId: initialCampaign, areaId: initialParent });
  useReportDirty(name !== '' || parents.campaignId !== initialCampaign || parents.areaId !== initialParent, onDirtyChange);
  const valid = !!name.trim();
  // Create it (when valid) and close the dialog.
  const create = () => {
    if (!valid) return;
    useLibrary.getState().addArea(name.trim(), parents.campaignId, parents.areaId);
    useUi.getState().closeModal();
  };
  return (
    <div className="create-fields">
      <label className="field grow">
        Area name
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
      </label>
      <ParentPicker {...parents} showArea areaLabel="Inside area" onChange={setParents} />
      <button className="primary" disabled={!valid} onClick={create}>Create Area</button>
    </div>
  );
}
