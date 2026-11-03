/**
 * @file A Character page's stat block: the Stat block button in the page's
 * info bar, and the panel it opens beside the page. The panel shows the stat
 * block (the same views and editors as Encounters), edits it, starts one in a
 * chosen game system, and, when the notebook is linked, offers the stat block
 * of the Encounters character made from this page when it differs.
 */
import { sameStatBlock, type LinkCharacter, type SharedStatBlock } from 'campaign-link';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { FORMAT_LIST, getFormat } from 'campaign-link/formats/registry';
import { FORMAT_UI } from 'campaign-link/ui/formats/formatUi';
import { ExternalLink, Pencil, ScrollText, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { Page } from '../../domain/notebook';
import { openInEncounters } from '../../state/appLinks';
import { useOpenNotebookCatalog } from '../../state/campaignLink';
import { useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';

/** Shows or hides the stat block panel (it stays open from one Character page to the next). */
export function StatBlockButton() {
  const open = useUi((s) => s.statBlockOpen);
  return (
    <button
      className={`stat-block-button${open ? ' active' : ''}`}
      aria-pressed={open}
      title={open ? 'Hide the stat block' : 'Show the stat block'}
      // Keep the caret in the box being written in.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => useUi.getState().toggleStatBlock()}
    >
      <ScrollText size={15} /> Stat block
    </button>
  );
}

/** The panel beside a Character page. Keyed by page, so Edit resets when another page opens. */
export function StatBlockPanel({ page }: { page: Page }) {
  const current = page.statBlock;
  const [editing, setEditing] = useState(false);
  const kind = page.info?.type === 'character' ? page.info.kind : 'npc';
  const setStatBlock = (statBlock: SharedStatBlock | undefined) => useNotebook.getState().setPageStatBlock(page.id, statBlock);

  // Asks before deleting the stat block.
  const remove = () =>
    useUi.getState().askConfirm({
      message: `Remove ${page.title}'s stat block?`,
      confirmLabel: 'Remove stat block',
      onConfirm: () => {
        setStatBlock(undefined);
        setEditing(false);
      },
    });

  const { View, Editor } = current ? FORMAT_UI[current.formatId] : { View: null, Editor: null };
  return (
    <aside className={`statblock-panel${editing ? ' editing' : ''}`}>
      <div className="statblock-panel-header">
        <ScrollText size={17} />
        <h3>Stat block</h3>
        {current && <span className="muted">{getFormat(current.formatId).name}</span>}
        <span className="spacer" />
        {current && (
          <button className={editing ? 'primary' : ''} onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : <><Pencil size={14} /> Edit</>}
          </button>
        )}
        <button className="icon" title="Hide the stat block" onClick={() => useUi.getState().toggleStatBlock()}>
          <X size={17} />
        </button>
      </div>
      <div className="statblock-panel-body">
        <EncountersCopies page={page} current={current} onTake={(s) => setStatBlock(s)} />
        {!current && <NewStatBlock onCreate={(s) => { setStatBlock(s); setEditing(true); }} />}
        {current && !editing && View && <View statBlock={current.statBlock} kind={kind} />}
        {current && editing && Editor && (
          <>
            <FormatPicker
              value={current.formatId}
              onChange={(formatId) => setStatBlock(withFormat(current, formatId))}
            />
            <Editor value={current.statBlock} kind={kind} onChange={(statBlock) => setStatBlock({ ...current, statBlock })} />
            <div className="row">
              <span className="spacer" />
              <button onClick={remove}>
                <Trash2 size={14} /> Remove stat block
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

/** Switches a stat block's game system; one with another stat block shape starts over (as in Encounters). */
function withFormat(current: SharedStatBlock, formatId: FormatId): SharedStatBlock {
  const keeps = getFormat(formatId).statBlockType === getFormat(current.formatId).statBlockType;
  return { formatId, statBlock: keeps ? current.statBlock : getFormat(formatId).createEmptyStatBlock() };
}

/** Game system dropdown. */
function FormatPicker({ value, onChange }: { value: FormatId | ''; onChange(formatId: FormatId): void }) {
  return (
    <label className="field">
      Game system
      <select value={value} onChange={(e) => e.target.value && onChange(e.target.value as FormatId)}>
        {value === '' && <option value="">Choose…</option>}
        {FORMAT_LIST.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Starts a blank stat block in a chosen system (the linked campaign's, to begin with). */
function NewStatBlock({ onCreate }: { onCreate(statBlock: SharedStatBlock): void }) {
  const campaignFormat = useOpenNotebookCatalog()?.formatId;
  const [formatId, setFormatId] = useState<FormatId | ''>(campaignFormat ?? '');
  return (
    <div className="statblock-new">
      <p className="muted">No stat block yet. Pick the game system to start one.</p>
      <div className="row wrap">
        <FormatPicker value={formatId} onChange={setFormatId} />
        <button
          className="primary"
          disabled={!formatId}
          onClick={() => formatId && onCreate({ formatId, statBlock: getFormat(formatId).createEmptyStatBlock() })}
        >
          Add stat block
        </button>
      </div>
    </div>
  );
}

/** Props for EncountersCopies. */
interface CopiesProps {
  page: Page;
  current: SharedStatBlock | undefined;
  onTake(statBlock: SharedStatBlock): void;
}

/**
 * The stat blocks of Encounters characters made from this page: each that
 * differs from the page's can replace it, and one that matches says so.
 */
function EncountersCopies({ page, current, onTake }: CopiesProps) {
  const catalog = useOpenNotebookCatalog();
  const characters = (catalog?.characters ?? []).filter(
    (c): c is LinkCharacter & { statBlock: SharedStatBlock } => c.lorePageId === page.id && !!c.statBlock,
  );
  if (characters.length === 0) return null;

  const differing = characters.filter((c) => !sameStatBlock(c.statBlock, current));
  if (differing.length === 0) {
    return <p className="statblock-sync muted">Same as {characters.length > 1 ? 'the Encounters characters' : 'in Encounters'}.</p>;
  }

  // Replacing the page's own stat block asks first.
  const take = (c: LinkCharacter & { statBlock: SharedStatBlock }) => {
    if (!current) return onTake(c.statBlock);
    useUi.getState().askConfirm({
      message: `Replace this page's stat block with the one from "${c.name}" in Encounters?`,
      confirmLabel: 'Replace',
      onConfirm: () => onTake(c.statBlock),
    });
  };

  return (
    <div className="statblock-sync">
      {differing.map((c) => (
        <div key={c.id} className="statblock-sync-row">
          <span className="spacer">
            {current ? 'Encounters has a different stat block' : 'Encounters has a stat block'}
            {characters.length > 1 && <> for <strong>{c.name}</strong></>} ({getFormat(c.statBlock.formatId).name}).
          </span>
          <button onClick={() => take(c)}>Use Encounters'</button>
          <button
            className="icon"
            title={`Open "${c.name}" in Encounters (its editor can take this page's stat block)`}
            onClick={() => openInEncounters({ app: 'encounters', kind: 'character', characterId: c.id })}
          >
            <ExternalLink size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
