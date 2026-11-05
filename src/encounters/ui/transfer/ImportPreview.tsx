/**
 * @file The import preview dialog: what the file contains vs. the app,
 * placement, conflicts, then Import.
 */
import { useMemo, useState } from 'react';
import { openConflicts, planImport, type Resolution } from '../../domain/transfer/plan';
import type { TransferFile, TransferKind } from '../../domain/transfer/types';
import { activeCampaignId } from '../../../campaigns/campaignStore';
import { commitImport, currentAppData } from '../../state/transferActions';
import { useUi } from '../../state/uiStore';
import { Modal } from '../../../ui/Modal';
import { ParentPicker } from '../create/ParentPicker';
import { ConflictList } from '../../../transfer/ui/ConflictList';
import { ImportSummary } from '../../../transfer/ui/ImportSummary';
import '../../../transfer/ui/transfer.css';

/** Dialog title per kind of export file. */
const KIND_TITLE: Record<TransferKind, string> = {
  characters: 'Import characters',
  encounter: 'Import encounter',
  area: 'Import area',
  campaign: 'Import campaign',
  everything: 'Restore backup',
};

/** Preview and options for importing one file; nothing changes until Import. */
export function ImportPreview({ file }: { file: TransferFile }) {
  const closeModal = useUi((s) => s.closeModal);
  // Plan once against the data as it was when the dialog opened.
  const plan = useMemo(() => planImport(file, currentAppData()), [file]);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  // Into the open campaign unless the user picks another.
  const [placement, setPlacement] = useState(() => ({ campaignId: activeCampaignId(), areaId: null as string | null }));

  const conflicts = openConflicts(file.data, plan, resolutions);
  const exported = new Date(file.exportedAt);

  // Apply the import; closes only if it succeeded.
  const doImport = () => {
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
          <button className="primary" onClick={doImport}>Import</button>
        </>
      }
    >
      <div className="import-preview">
        {!Number.isNaN(exported.getTime()) && <p className="muted">Exported {exported.toLocaleString()}</p>}
        <ImportSummary items={plan.items} />
        {plan.items.length === 0 && <p className="muted">This file only contains tags or conditions.</p>}

        {plan.placement !== 'none' && (
          <section className="import-section">
            <h3>Where should it go?</h3>
            {file.kind !== 'area' && file.kind !== 'encounter' && (
              <p className="muted">Some encounters in this file aren't in a campaign; they go into the one you pick.</p>
            )}
            <div className="row wrap">
              <ParentPicker {...placement} showArea={plan.placement === 'optional'} onChange={setPlacement} />
            </div>
          </section>
        )}

        <ConflictList conflicts={conflicts} resolutions={resolutions} onChange={setResolutions} />
        <p className="muted">Tags and custom conditions are merged by name.</p>
      </div>
    </Modal>
  );
}
