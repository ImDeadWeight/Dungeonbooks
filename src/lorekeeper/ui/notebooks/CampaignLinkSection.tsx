/**
 * @file The notebook menu's Encounters section: whether the notebook is
 * linked to an Encounters campaign, and the picker to link it.
 */
import { Link2, Link2Off, Swords } from 'lucide-react';
import { useState } from 'react';
import { useCatalogs } from '../../../bridge/catalogs';
import { useLinks } from '../../../bridge/links';
import type { Id } from '../../domain/ids';
import { byName } from '../../domain/notebook';
import { linkCampaign, unlinkNotebook, useLinkedCampaignId } from '../../state/campaignLink';
import { useLibrary } from '../../state/libraryStore';
import { Modal } from '../common/Modal';

/** Status line and link/unlink button for one notebook. */
export function CampaignLinkSection({ notebookId, onPick }: { notebookId: Id; onPick: () => void }) {
  const campaignId = useLinkedCampaignId(notebookId);
  const campaignName = useCatalogs((s) => s.campaigns.find((c) => c.id === campaignId)?.name);
  return (
    <div className="campaign-link-section">
      <Swords size={15} className="campaign-link-icon" />
      {!campaignId ? (
        <>
          <span className="spacer muted">Not linked to an Encounters campaign</span>
          <button onClick={onPick}>
            <Link2 size={15} /> Link…
          </button>
        </>
      ) : (
        <>
          <span className="spacer">
            Linked to <strong>{campaignName ?? 'a campaign that no longer exists'}</strong>
          </span>
          <button onClick={() => unlinkNotebook(notebookId)} title="Unlink">
            <Link2Off size={15} /> Unlink
          </button>
        </>
      )}
    </div>
  );
}

/** Lists Encounters' campaigns; picking one links the notebook to it. */
export function LinkCampaignDialog({ notebookId, close }: { notebookId: Id; close: () => void }) {
  const allCampaigns = useCatalogs((s) => s.campaigns);
  const links = useLinks((s) => s.notebookByCampaign);
  const notebooks = useLibrary((s) => s.notebooks);
  const notebookName = notebooks.find((n) => n.id === notebookId)?.name ?? 'this notebook';
  const [query, setQuery] = useState('');

  const campaigns = allCampaigns
    .filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => byName(a.name, b.name));

  /** The other notebook a campaign is already linked to, if any. */
  const linkedElsewhere = (campaignId: Id) => {
    const other = links[campaignId];
    return other && other !== notebookId ? notebooks.find((n) => n.id === other)?.name ?? 'another notebook' : null;
  };

  return (
    <Modal title={`Link "${notebookName}" to Encounters`} size="small" onClose={close} footer={<button onClick={close}>Cancel</button>}>
      {allCampaigns.length === 0 ? (
        <p className="muted">There are no campaigns yet. Create one in the Encounters tab, then come back.</p>
      ) : (
        <div className="link-campaign-picker">
          <input autoFocus placeholder="Search campaigns" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="link-campaign-list">
            {campaigns.length === 0 && <p className="muted">No campaigns match.</p>}
            {campaigns.map((c) => {
              const elsewhere = linkedElsewhere(c.id);
              return (
                <button
                  key={c.id}
                  className="link-campaign-option"
                  disabled={!!elsewhere}
                  title={elsewhere ? `Already linked to "${elsewhere}"; unlink it there first` : undefined}
                  onClick={() => {
                    linkCampaign(c.id, notebookId);
                    close();
                  }}
                >
                  <Swords size={15} />
                  <span className="spacer">{c.name}</span>
                  {elsewhere && <span className="muted">linked to {elsewhere}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
