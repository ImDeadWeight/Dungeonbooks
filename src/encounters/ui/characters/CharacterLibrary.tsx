/**
 * @file The Characters window: search/filter all characters, create, edit,
 * delete, and select several to export.
 */
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EMPTY_FILTER, filterTemplates } from '../../domain/characterSearch';
import type { CharacterTemplate } from '../../domain/characters';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { encountersUsingTemplate } from '../../domain/library/tree';
import { useCharacters } from '../../state/characterStore';
import { useLibrary } from '../../state/libraryStore';
import { exportItems } from '../../state/transferActions';
import { useUi } from '../../state/uiStore';
import { confirmThen } from '../common/ConfirmDialog';
import { Modal } from '../common/Modal';
import { closeUnlessDirty } from '../common/unsavedChanges';
import { CharacterEditor } from './CharacterEditor';
import { CharacterFilterBar } from './CharacterFilterBar';

/** Templates still used by an encounter can't be deleted (encounters link to them live). */
function deleteTemplate(t: CharacterTemplate) {
  const using = encountersUsingTemplate(useLibrary.getState(), t.id);
  if (using.length > 0) {
    useUi.getState().notify(
      'error',
      `${t.name} is used in ${using.map((e) => `"${e.name}"`).join(', ')}. Remove it from those encounters first.`,
    );
    return;
  }
  confirmThen(`Delete ${t.name}?`, 'Delete', () => useCharacters.getState().deleteTemplate(t.id));
}

/** Lists characters with edit/delete buttons and multi-select export. */
export function CharacterLibrary() {
  const templates = useCharacters((s) => s.templates);
  const { closeModal, openModal } = useUi.getState();
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const shown = filterTemplates(templates, filter);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Deleted characters drop out of the selection.
  const selectedIds = templates.filter((t) => selected.has(t.id)).map((t) => t.id);
  const allShownSelected = shown.length > 0 && shown.every((t) => selected.has(t.id));

  // Select or deselect one character for export.
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Select or deselect every character the filter currently shows.
  const toggleAllShown = () =>
    setSelected((s) => {
      const next = new Set(s);
      for (const t of shown) {
        if (allShownSelected) next.delete(t.id);
        else next.add(t.id);
      }
      return next;
    });

  return (
    <Modal title="Characters" onClose={closeModal}>
      <div className="character-editor">
        <div className="row">
          <div className="spacer">
            <CharacterFilterBar filter={filter} onChange={setFilter} />
          </div>
          <button className="primary" onClick={() => openModal({ type: 'editCharacter', templateId: null })}>
            <Plus size={16} /> New
          </button>
        </div>
        <div className="row">
          <label className="inline">
            <input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} disabled={shown.length === 0} />
            Select all shown
          </label>
          <span className="spacer" />
          <button
            disabled={selectedIds.length === 0}
            title="Export the selected characters to a file"
            onClick={() => exportItems({ kind: 'characters', ids: selectedIds })}
          >
            <Download size={16} /> Export selected{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </button>
        </div>
        <div className="character-list">
          {shown.length === 0 && <p className="empty-state">No characters match.</p>}
          {shown.map((t) => (
            <div key={t.id} className="character-item">
              <input type="checkbox" aria-label={`Select ${t.name}`} checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
              <span className="name">{t.name}</span>
              <span className="chip">{t.kind === 'pc' ? 'PC' : 'NPC'}</span>
              {!t.statBlock && <span className="muted">no stat block</span>}
              <button className="icon" title="Edit" onClick={() => openModal({ type: 'editCharacter', templateId: t.id })}>
                <Pencil size={16} />
              </button>
              <button className="icon" title="Delete" onClick={() => deleteTemplate(t)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/** Dialog wrapping CharacterEditor for a new (null) or existing character. */
export function EditCharacterModal({ templateId, defaultFormatId }: { templateId: string | null; defaultFormatId: FormatId | null }) {
  const closeModal = useUi((s) => s.closeModal);
  const [dirty, setDirty] = useState(false);
  return (
    <Modal title={templateId ? 'Edit character' : 'New character'} onClose={() => closeUnlessDirty(dirty, closeModal)}>
      <CharacterEditor templateId={templateId} defaultFormatId={defaultFormatId} onDone={closeModal} onDirtyChange={setDirty} />
    </Modal>
  );
}
