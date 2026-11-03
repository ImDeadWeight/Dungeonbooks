/**
 * @file Edit dialogs for sidebar items: rename an area or encounter and change
 * which campaign/area it belongs to (areas can sit inside other areas), change
 * an empty encounter's format, or rename a campaign, set its default format
 * and link it to a Lorekeeper notebook.
 */
import { useMemo, useState } from 'react';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { descendantAreaIds, type EncounterDestination } from '../../domain/library/tree';
import type { Id } from '../../domain/ids';
import { useLinks } from '../../../bridge/links';
import { linkCampaign } from '../../state/campaignLink';
import { useLibrary } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';
import { FormatField } from '../common/FormatField';
import { Modal } from '../common/Modal';
import { closeUnlessDirty } from '../common/unsavedChanges';
import { ParentPicker } from '../create/ParentPicker';
import { CampaignFormatField } from '../create/SimpleForms';
import { LorekeeperNotebookField } from './LorekeeperNotebookField';

/** Which item to edit. */
interface Props {
  kind: 'area' | 'encounter';
  id: Id;
}

/** Converts chosen parents into a move destination. */
function destinationOf(campaignId: Id | null, areaId: Id | null): EncounterDestination {
  if (areaId) return { kind: 'area', areaId };
  if (campaignId) return { kind: 'campaign', campaignId };
  return { kind: 'root' };
}

/** Rename an area or encounter and change which campaign/area it belongs to. */
export function EditTreeItem({ kind, id }: Props) {
  const item = useLibrary((s) => (kind === 'area' ? s.areas : s.encounters).find((x) => x.id === id));
  const closeModal = useUi((s) => s.closeModal);
  const [name, setName] = useState(item?.name ?? '');
  const [initialParents] = useState({
    campaignId: item?.campaignId ?? null,
    // For an area, the "area" picked is the one it sits inside.
    areaId: !item ? null : 'parentAreaId' in item ? item.parentAreaId : item.areaId,
  });
  const [parents, setParents] = useState(initialParents);
  // Encounters only; areas have no format.
  const initialFormat = item && 'formatId' in item ? item.formatId : null;
  const [formatId, setFormatId] = useState<FormatId | null>(initialFormat);
  // An area can't move into itself or anything nested in it.
  const excluded = useMemo(
    () => (kind === 'area' ? new Set([id, ...descendantAreaIds(useLibrary.getState(), id)]) : undefined),
    [kind, id],
  );
  if (!item) return null;

  // Needs a name; areas also need a campaign.
  const valid = !!name.trim() && (kind === 'encounter' || !!parents.campaignId);
  const dirty =
    name !== item.name ||
    parents.campaignId !== initialParents.campaignId ||
    parents.areaId !== initialParents.areaId ||
    formatId !== initialFormat;
  // Characters already in the encounter use its format, so it can only change while empty.
  const formatLocked = 'combatants' in item && item.combatants.length > 0;
  const cancel = () => closeUnlessDirty(dirty, closeModal);
  // Apply the rename and move, then close.
  const save = () => {
    if (!valid) return;
    const lib = useLibrary.getState();
    if (name.trim() !== item.name) lib.rename(kind, id, name.trim());
    if (kind === 'area' && parents.campaignId) {
      lib.moveArea(id, parents.areaId ? { kind: 'area', areaId: parents.areaId } : { kind: 'campaign', campaignId: parents.campaignId });
    }
    if (kind === 'encounter') lib.moveEncounter(id, destinationOf(parents.campaignId, parents.areaId));
    if (kind === 'encounter' && formatId && formatId !== initialFormat) lib.setEncounterFormat(id, formatId);
    closeModal();
  };

  return (
    <Modal
      title={kind === 'area' ? 'Edit area' : 'Edit encounter'}
      size="small"
      onClose={cancel}
      footer={
        <>
          <button onClick={cancel}>Cancel</button>
          <button className="primary" disabled={!valid} onClick={save}>Save</button>
        </>
      }
    >
      <div className="edit-tree-item">
        <label className="field">
          Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </label>
        <ParentPicker
          {...parents}
          requireCampaign={kind === 'area'}
          showArea
          areaLabel={kind === 'area' ? 'Inside area' : 'Area'}
          excludeAreaIds={excluded}
          onChange={setParents}
        />
        {kind === 'area' && <p className="muted">Areas and encounters inside this area move with it.</p>}
        {formatId && (
          <FormatField
            value={formatId}
            disabled={formatLocked}
            title={formatLocked ? 'Remove every character from the encounter to change its format' : undefined}
            onChange={setFormatId}
          />
        )}
      </div>
    </Modal>
  );
}

/** Rename a campaign and choose the format its new encounters and characters start with. */
export function EditCampaign({ id }: { id: Id }) {
  const campaign = useLibrary((s) => s.campaigns.find((c) => c.id === id));
  const closeModal = useUi((s) => s.closeModal);
  const [name, setName] = useState(campaign?.name ?? '');
  const [formatId, setFormatId] = useState(campaign?.formatId ?? null);
  const [initialNotebook] = useState<Id | null>(() => useLinks.getState().notebookByCampaign[id] ?? null);
  const [notebookId, setNotebookId] = useState<Id | null>(initialNotebook);
  if (!campaign) return null;
  const dirty = name !== campaign.name || formatId !== campaign.formatId || notebookId !== initialNotebook;
  const cancel = () => closeUnlessDirty(dirty, closeModal);

  // Apply the rename, format and Lorekeeper link, then close.
  const save = () => {
    if (!name.trim()) return;
    const lib = useLibrary.getState();
    if (name.trim() !== campaign.name) lib.rename('campaign', id, name.trim());
    if (formatId !== campaign.formatId) lib.setCampaignFormat(id, formatId);
    if (notebookId !== initialNotebook) linkCampaign(id, notebookId);
    closeModal();
  };

  return (
    <Modal
      title="Edit campaign"
      size="small"
      onClose={cancel}
      footer={
        <>
          <button onClick={cancel}>Cancel</button>
          <button className="primary" disabled={!name.trim()} onClick={save}>Save</button>
        </>
      }
    >
      <div className="edit-tree-item">
        <label className="field">
          Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </label>
        <CampaignFormatField value={formatId} onChange={setFormatId} />
        <p className="muted">
          New encounters in this campaign, and new characters created for them, start with this format. Existing
          encounters and characters are not changed.
        </p>
        <LorekeeperNotebookField campaignId={id} value={notebookId} onChange={setNotebookId} />
      </div>
    </Modal>
  );
}
