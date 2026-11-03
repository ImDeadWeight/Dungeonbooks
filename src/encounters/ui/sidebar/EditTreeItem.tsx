/**
 * @file Edit dialog for sidebar items: rename an area or encounter and change
 * which campaign/area it belongs to (areas can sit inside other areas), and
 * change an empty encounter's format. Campaigns are edited from the campaign
 * menu.
 */
import { useMemo, useState } from 'react';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { descendantAreaIds, type EncounterDestination } from '../../domain/library/tree';
import { activeCampaignId } from '../../../campaigns/campaignStore';
import type { Id } from '../../domain/ids';
import { useLibrary } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';
import { FormatField } from '../common/FormatField';
import { Modal } from '../../../ui/Modal';
import { closeUnlessDirty } from '../common/unsavedChanges';
import { ParentPicker } from '../create/ParentPicker';

/** Which item to edit. */
interface Props {
  kind: 'area' | 'encounter';
  id: Id;
}

/** Converts chosen parents into a move destination. */
function destinationOf(campaignId: Id, areaId: Id | null): EncounterDestination {
  return areaId ? { kind: 'area', areaId } : { kind: 'campaign', campaignId };
}

/** Rename an area or encounter and change which campaign/area it belongs to. */
export function EditTreeItem({ kind, id }: Props) {
  const item = useLibrary((s) => (kind === 'area' ? s.areas : s.encounters).find((x) => x.id === id));
  const closeModal = useUi((s) => s.closeModal);
  const [name, setName] = useState(item?.name ?? '');
  const [initialParents] = useState({
    campaignId: item?.campaignId ?? activeCampaignId(),
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

  const valid = !!name.trim();
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
    if (kind === 'area') lib.moveArea(id, destinationOf(parents.campaignId, parents.areaId));
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
