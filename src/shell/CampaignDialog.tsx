/**
 * @file A campaign's settings: its name, default format and usual party,
 * exporting it as one campaign file, and deleting it (after asking).
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCampaigns } from '../campaigns/campaignStore';
import { deleteCampaign, renameCampaign, setCampaignFormat, setCampaignParty } from '../campaigns/lifecycle';
import type { PartySize } from '../campaigns/types';
import { exportCampaignFile } from '../transfer/exportCampaign';
import { Modal } from '../ui/Modal';
import { CampaignFormatField } from './CampaignFormatField';
import { CampaignPartyField } from './CampaignPartyField';

/** Settings for one campaign; switches to an are-you-sure step before deleting. */
export function CampaignDialog({ id, close }: { id: string; close(): void }) {
  const campaign = useCampaigns((s) => s.campaigns.find((c) => c.id === id));
  const [name, setName] = useState(campaign?.name ?? '');
  const [formatId, setFormatId] = useState<FormatId | null>(campaign?.formatId ?? null);
  const [party, setParty] = useState<PartySize | null>(campaign?.party ?? null);
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

  // Apply the name, format and party, then close.
  const save = () => {
    if (!name.trim()) return;
    if (name.trim() !== campaign.name) renameCampaign(id, name);
    if (formatId !== campaign.formatId) setCampaignFormat(id, formatId);
    if (JSON.stringify(party) !== JSON.stringify(campaign.party ?? null)) setCampaignParty(id, party);
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
        <CampaignPartyField value={party} onChange={setParty} />
        <div className="campaign-dialog-exports">
          <button onClick={() => exportCampaignFile(id)} title="Its encounters and notes, with their characters and pictures, as one file">
            <Download size={15} /> Export campaign…
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
