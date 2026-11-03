/**
 * @file A campaign's settings: its name and default format, exporting its
 * encounters or its notes, and deleting it (after asking).
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCampaigns } from '../campaigns/campaignStore';
import { deleteCampaign, renameCampaign, setCampaignFormat } from '../campaigns/lifecycle';
import { exportItems } from '../encounters/state/transferActions';
import { exportNotebook } from '../lorekeeper/state/notebooks';
import { Modal } from '../ui/Modal';
import { CampaignFormatField } from './CampaignFormatField';

/** Settings for one campaign; switches to an are-you-sure step before deleting. */
export function CampaignDialog({ id, close }: { id: string; close(): void }) {
  const campaign = useCampaigns((s) => s.campaigns.find((c) => c.id === id));
  const [name, setName] = useState(campaign?.name ?? '');
  const [formatId, setFormatId] = useState<FormatId | null>(campaign?.formatId ?? null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  if (!campaign) return null;

  if (confirmingDelete) {
    return (
      <Modal
        title="Are you sure?"
        size="small"
        onClose={() => setConfirmingDelete(false)}
        footer={
          <>
            <button onClick={() => setConfirmingDelete(false)}>Cancel</button>
            <button
              className="damage"
              autoFocus
              onClick={() => {
                close();
                deleteCampaign(id);
              }}
            >
              Delete campaign
            </button>
          </>
        }
      >
        <p>
          Delete the campaign "{campaign.name}" with all of its areas, encounters and notes? This can't be undone, so
          export it first if you might want it back. Characters stay in the character library.
        </p>
      </Modal>
    );
  }

  // Apply the name and format, then close.
  const save = () => {
    if (!name.trim()) return;
    if (name.trim() !== campaign.name) renameCampaign(id, name);
    if (formatId !== campaign.formatId) setCampaignFormat(id, formatId);
    close();
  };

  return (
    <Modal
      title="Campaign"
      size="small"
      onClose={close}
      footer={
        <>
          <button onClick={close}>Cancel</button>
          <button className="primary" disabled={!name.trim()} onClick={save}>Save</button>
        </>
      }
    >
      <div className="campaign-dialog">
        <label className="field">
          Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </label>
        <CampaignFormatField value={formatId} onChange={setFormatId} />
        <div className="campaign-dialog-exports">
          <button onClick={() => exportItems({ kind: 'campaign', id, name: campaign.name })} title="Its areas and encounters, with the characters in them">
            <Download size={15} /> Export encounters…
          </button>
          <button onClick={() => exportNotebook(id)} title="Its notes, as a Lorekeeper notebook">
            <Download size={15} /> Export notes…
          </button>
        </div>
        <div className="campaign-dialog-danger">
          <span className="spacer muted">Deletes its encounters and notes.</span>
          <button className="damage" onClick={() => setConfirmingDelete(true)}>
            <Trash2 size={15} /> Delete…
          </button>
        </div>
      </div>
    </Modal>
  );
}
