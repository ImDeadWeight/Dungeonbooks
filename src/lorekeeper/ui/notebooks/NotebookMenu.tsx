/**
 * @file The notebook menu in the top bar: shows the open notebook's name and
 * drops down a list to switch, rename (double-click or pencil) or delete
 * notebooks, plus new / import / export.
 */
import { BookOpen, Check, ChevronDown, Download, Link2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Id } from '../../domain/ids';
import type { NotebookInfo } from '../../domain/library';
import { byName } from '../../domain/notebook';
import { useLibrary } from '../../state/libraryStore';
import {
  createNotebook,
  deleteNotebook,
  exportNotebook,
  importNotebook,
  renameNotebook,
  switchNotebook,
} from '../../state/notebooks';
import { useLinkedCampaignId } from '../../state/campaignLink';
import { useUi } from '../../state/uiStore';
import { CampaignLinkSection, LinkCampaignDialog } from './CampaignLinkSection';
import './notebooks.css';

/** Asks before deleting a notebook. */
function confirmDelete(notebook: NotebookInfo) {
  useUi.getState().askConfirm({
    message: `Delete the notebook "${notebook.name}" and every page in it? This can't be undone, so export it first if you might want it back.`,
    confirmLabel: 'Delete notebook',
    onConfirm: () => deleteNotebook(notebook.id),
  });
}

/** Props for NotebookRow. */
interface RowProps {
  notebook: NotebookInfo;
  active: boolean;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  /** Closes the menu. */
  done: () => void;
}

/** One notebook in the list: click to open it. */
function NotebookRow({ notebook, active, editing, setEditing, done }: RowProps) {
  const linked = useLinkedCampaignId(notebook.id) !== null;
  // Finish inline renaming; blank or unchanged names are ignored.
  const commit = (value: string) => {
    setEditing(false);
    if (value.trim() !== notebook.name) renameNotebook(notebook.id, value);
  };

  return (
    <div
      className={`notebook-row${active ? ' active' : ''}`}
      role="menuitem"
      onClick={() => {
        if (editing) return;
        switchNotebook(notebook.id);
        done();
      }}
    >
      <span className="notebook-check">{active && <Check size={15} />}</span>
      {editing ? (
        <input
          autoFocus
          defaultValue={notebook.name}
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
        <span className="notebook-name" title="Double-click to rename" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
          {notebook.name}
        </span>
      )}
      {linked && (
        <span className="notebook-linked" title="Linked to an Encounters campaign">
          <Link2 size={14} />
        </span>
      )}
      <span className="notebook-row-actions">
        <button className="icon" title="Rename" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
          <Pencil size={14} />
        </button>
        <button className="icon" title="Export" onClick={(e) => { e.stopPropagation(); done(); exportNotebook(notebook.id); }}>
          <Download size={14} />
        </button>
        <button className="icon" title="Delete" onClick={(e) => { e.stopPropagation(); done(); confirmDelete(notebook); }}>
          <Trash2 size={14} />
        </button>
      </span>
    </div>
  );
}

/** The open notebook's name, as a button that opens the notebook list. */
export function NotebookMenu() {
  const notebooks = useLibrary((s) => s.notebooks);
  const activeId = useLibrary((s) => s.activeId);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id | null>(null);
  /** Notebook the link-to-Encounters picker is open for. */
  const [linkingId, setLinkingId] = useState<Id | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  const active = notebooks.find((n) => n.id === activeId);

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

  const sorted = [...notebooks].sort((a, b) => byName(a.name, b.name));

  return (
    <div className="notebook-menu" ref={menu}>
      <button className="notebook-current" onClick={() => (open ? close() : setOpen(true))} title="Switch notebook">
        <BookOpen size={16} />
        <span className="notebook-name">{active?.name ?? 'Notebook'}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="notebook-dropdown" role="menu">
          <div className="notebook-list">
            {sorted.map((n) => (
              <NotebookRow
                key={n.id}
                notebook={n}
                active={n.id === activeId}
                editing={editingId === n.id}
                setEditing={(editing) => setEditingId(editing ? n.id : null)}
                done={close}
              />
            ))}
          </div>
          {activeId && (
            <CampaignLinkSection
              notebookId={activeId}
              onPick={() => {
                close();
                setLinkingId(activeId);
              }}
            />
          )}
          <div className="notebook-dropdown-actions">
            <button
              onClick={async () => {
                const id = await createNotebook();
                if (id) setEditingId(id);
              }}
            >
              <Plus size={15} /> New notebook
            </button>
            <button onClick={() => { close(); importNotebook(); }}>
              <Upload size={15} /> Import…
            </button>
          </div>
        </div>
      )}
      {linkingId && <LinkCampaignDialog notebookId={linkingId} close={() => setLinkingId(null)} />}
    </div>
  );
}
