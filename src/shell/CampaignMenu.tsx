/**
 * @file The campaign menu in both tabs' top bars: the open campaign's name,
 * dropping down the list to switch campaigns, rename one (double-click or
 * pencil) or open its settings, plus New campaign and Export this campaign.
 */
import { Castle, Check, ChevronDown, Download, Pencil, Plus, Settings2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useActiveCampaign, useCampaigns } from '../campaigns/campaignStore';
import { createCampaign, renameCampaign, switchCampaign } from '../campaigns/lifecycle';
import { byName, NEW_CAMPAIGN_NAME, type Campaign } from '../campaigns/types';
import { exportCampaignFile } from '../transfer/exportCampaign';
import { CampaignDialog } from './CampaignDialog';
import './campaignMenu.css';

/** Props for CampaignRow. */
interface RowProps {
  campaign: Campaign;
  active: boolean;
  editing: boolean;
  setEditing(editing: boolean): void;
  openSettings(): void;
  /** Closes the menu. */
  done(): void;
}

/** One campaign in the list: click to open it. */
function CampaignRow({ campaign, active, editing, setEditing, openSettings, done }: RowProps) {
  // Finish inline renaming; blank or unchanged names are ignored.
  const commit = (value: string) => {
    setEditing(false);
    if (value.trim() !== campaign.name) renameCampaign(campaign.id, value);
  };

  return (
    <div
      className={`campaign-row${active ? ' active' : ''}`}
      role="menuitem"
      onClick={() => {
        if (editing) return;
        switchCampaign(campaign.id);
        done();
      }}
    >
      <span className="campaign-check">{active && <Check size={15} />}</span>
      {editing ? (
        <input
          autoFocus
          defaultValue={campaign.name}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit(e.currentTarget.value);
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
        />
      ) : (
        <span className="campaign-name" title="Double-click to rename" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
          {campaign.name}
        </span>
      )}
      <span className="campaign-row-actions">
        <button className="icon" title="Rename" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
          <Pencil size={14} />
        </button>
        <button className="icon" title="Settings, export, delete" onClick={(e) => { e.stopPropagation(); done(); openSettings(); }}>
          <Settings2 size={14} />
        </button>
      </span>
    </div>
  );
}

/** The open campaign's name, as a button that opens the campaign list. */
export function CampaignMenu() {
  const campaigns = useCampaigns((s) => s.campaigns);
  const active = useActiveCampaign();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Campaign whose settings dialog is open. */
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const menu = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setEditingId(null);
  };

  // Click outside or Escape closes the list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !menu.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sorted = [...campaigns].sort((a, b) => byName(a.name, b.name));

  return (
    <div className="campaign-menu" ref={menu}>
      <button className="campaign-current" onClick={() => (open ? close() : setOpen(true))} title="Switch campaign">
        <Castle size={16} className="campaign-icon" />
        <span className="campaign-name">{active?.name ?? 'Campaign'}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="campaign-dropdown" role="menu">
          <div className="campaign-list">
            {sorted.map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                active={c.id === active?.id}
                editing={editingId === c.id}
                setEditing={(editing) => setEditingId(editing ? c.id : null)}
                openSettings={() => setSettingsId(c.id)}
                done={close}
              />
            ))}
          </div>
          <div className="campaign-dropdown-actions">
            <button
              onClick={async () => {
                // Opens it, then offers its name for editing.
                setEditingId(await createCampaign({ name: NEW_CAMPAIGN_NAME }));
              }}
            >
              <Plus size={15} /> New campaign
            </button>
            {active && (
              <button
                title="Its encounters and notes, with their characters and pictures, as one file"
                onClick={() => {
                  close();
                  exportCampaignFile(active.id);
                }}
              >
                <Download size={15} /> Export this campaign…
              </button>
            )}
          </div>
        </div>
      )}
      {settingsId && <CampaignDialog id={settingsId} close={() => setSettingsId(null)} />}
    </div>
  );
}
