/**
 * @file The campaign import preview, drawn once by the shell: what the file
 * holds against what is here (encounters item by item, notes page by page),
 * the conflicts to decide, and what that means for the notes; then Import.
 */
import { useMemo, useState } from 'react';
import { openConflicts, type Resolution } from '../../encounters/domain/transfer/plan';
import { currentAppData } from '../../encounters/state/transferActions';
import { Modal } from '../../ui/Modal';
import { notesAction, notesStatus, pageCounts, planCampaignImport, type NotesAction } from '../campaignPlan';
import { commitCampaignImport } from '../commitCampaignImport';
import { closeImportDialog, useImportDialog, type PendingImport } from '../importDialog';
import { ConflictList } from './ConflictList';
import { ImportSummary } from './ImportSummary';
import './transfer.css';

/** What the notes will do, said for the campaign's conflict row. */
const NOTES_OUTCOME: Record<NotesAction, string> = {
  add: 'Its notes come in with it.',
  replace: "The file's notes replace this campaign's notes here.",
  copy: "The copy gets the file's notes; the notes here stay as they are.",
  skip: "The notes here stay as they are; the file's notes aren't imported.",
};

/** The preview for one file; nothing changes until Import. */
function Preview({ pending: { file, notesHere } }: { pending: PendingImport }) {
  // Planned once, against the data as it was when the dialog opened.
  const notes = useMemo(() => notesStatus(notesHere, file.notes), [file, notesHere]);
  const plan = useMemo(() => planCampaignImport(file, currentAppData(), notes), [file, notes]);
  const pages = useMemo(() => pageCounts(notesHere, file.notes), [file, notesHere]);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [busy, setBusy] = useState(false);

  const conflicts = openConflicts(file.encounters.data, plan, resolutions);
  const action = notesAction(file, plan, resolutions, notes);
  const campaignHere = plan.items.some((i) => i.type === 'campaign' && i.status !== 'new');
  const exported = new Date(file.exportedAt);

  const doImport = async () => {
    setBusy(true);
    if (await commitCampaignImport(file, plan, resolutions, notes)) closeImportDialog();
    else setBusy(false);
  };

  return (
    <Modal
      title={`Import "${file.campaign.name}"`}
      size="medium"
      onClose={closeImportDialog}
      footer={
        <>
          <button onClick={closeImportDialog}>Cancel</button>
          <button className="primary" disabled={busy} onClick={doImport}>Import</button>
        </>
      }
    >
      <div className="import-preview">
        {!Number.isNaN(exported.getTime()) && <p className="muted">Exported {exported.toLocaleString()}</p>}
        <p>{campaignHere ? 'This campaign is already here.' : 'A new campaign: it comes in whole, with its encounters and notes.'}</p>
        <ImportSummary items={plan.items} extra={file.notes.pages.length ? [{ label: 'Pages', counts: pages }] : []} />
        <ConflictList conflicts={conflicts} resolutions={resolutions} onChange={setResolutions} />
        {campaignHere && notes !== 'identical' && <p className="import-notes-outcome">{NOTES_OUTCOME[action]}</p>}
        <p className="muted">Tags and custom conditions are merged by name.</p>
      </div>
    </Modal>
  );
}

/** The preview while a campaign file is being imported. */
export function CampaignImportDialog() {
  const pending = useImportDialog((s) => s.pending);
  return pending ? <Preview pending={pending} /> : null;
}
