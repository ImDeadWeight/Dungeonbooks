/**
 * @file The import preview dialog: what the file contains vs. the app,
 * placement, conflicts, then Import.
 */
import { useMemo, useState } from 'react';
import { openConflicts, planImport, type ItemStatus, type PlanItem, type Resolution } from '../../domain/transfer/plan';
import type { TransferFile, TransferKind } from '../../domain/transfer/types';
import { useCharacters } from '../../state/characterStore';
import { useLibrary } from '../../state/libraryStore';
import { commitImport } from '../../state/transferActions';
import { useUi } from '../../state/uiStore';
import { Modal } from '../common/Modal';
import { ParentPicker } from '../create/ParentPicker';
import { ConflictList } from './ConflictList';
import './transfer.css';

/** Dialog title per kind of export file. */
const KIND_TITLE: Record<TransferKind, string> = {
  characters: 'Import characters',
  encounter: 'Import encounter',
  area: 'Import area',
  campaign: 'Import campaign',
  everything: 'Restore backup',
};

/** Row labels for the summary table. */
const TYPE_PLURAL: Record<PlanItem['type'], string> = {
  campaign: 'Campaigns',
  area: 'Areas',
  encounter: 'Encounters',
  character: 'Characters',
};

/** Table of new / already present / different counts per item type. */
function Summary({ items }: { items: PlanItem[] }) {
  const types = (Object.keys(TYPE_PLURAL) as PlanItem['type'][]).filter((t) => items.some((i) => i.type === t));
  // Items of a type with a given status.
  const count = (t: PlanItem['type'], s: ItemStatus) => items.filter((i) => i.type === t && i.status === s).length;
  return (
    <table className="import-summary">
      <thead>
        <tr><th /><th>New</th><th>Already present</th><th>Different</th></tr>
      </thead>
      <tbody>
        {types.map((t) => (
          <tr key={t}>
            <th>{TYPE_PLURAL[t]}</th>
            <td>{count(t, 'new')}</td>
            <td>{count(t, 'identical')}</td>
            <td>{count(t, 'conflict')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Preview and options for importing one file; nothing changes until Import. */
export function ImportPreview({ file }: { file: TransferFile }) {
  const closeModal = useUi((s) => s.closeModal);
  const campaigns = useLibrary((s) => s.campaigns);
  // Plan once against the data as it was when the dialog opened.
  const plan = useMemo(() => {
    const { campaigns: c, areas, encounters } = useLibrary.getState();
    const { templates, tags, customConditions } = useCharacters.getState();
    return planImport(file, { campaigns: c, areas, encounters, templates, tags, customConditions });
  }, [file]);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [placement, setPlacement] = useState({ campaignId: null as string | null, areaId: null as string | null });

  const conflicts = openConflicts(file.data, plan, resolutions);
  const needsCampaign = plan.placement === 'campaign-required';
  const blocked = needsCampaign && !placement.campaignId;
  const exported = new Date(file.exportedAt);

  // Apply the import; closes only if it succeeded.
  const doImport = () => {
    if (blocked) return;
    if (commitImport(file, plan, resolutions, placement)) closeModal();
  };

  return (
    <Modal
      title={KIND_TITLE[file.kind]}
      size="medium"
      onClose={closeModal}
      footer={
        <>
          <button onClick={closeModal}>Cancel</button>
          <button className="primary" disabled={blocked} onClick={doImport}>Import</button>
        </>
      }
    >
      <div className="import-preview">
        {!Number.isNaN(exported.getTime()) && <p className="muted">Exported {exported.toLocaleString()}</p>}
        <Summary items={plan.items} />
        {plan.items.length === 0 && <p className="muted">This file only contains tags or conditions.</p>}

        {plan.placement !== 'none' && (
          <section className="import-section">
            <h3>Where should it go?</h3>
            {needsCampaign && campaigns.length === 0 ? (
              <p className="muted">Areas live inside a campaign. Create a campaign first, then import again.</p>
            ) : (
              <div className="row wrap">
                <ParentPicker
                  {...placement}
                  requireCampaign={needsCampaign}
                  showArea={plan.placement === 'optional'}
                  onChange={setPlacement}
                />
              </div>
            )}
          </section>
        )}

        <ConflictList conflicts={conflicts} resolutions={resolutions} onChange={setResolutions} />
        <p className="muted">Tags and custom conditions are merged by name.</p>
      </div>
    </Modal>
  );
}
