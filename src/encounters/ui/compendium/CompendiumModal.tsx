/**
 * @file The "From the SRD" window, opened from the character library: pick
 * a game system, browse its creatures, and copy one into the library (to
 * edit, or to find in the encounter builder's own list).
 */
import { Check, Copy, Pencil } from 'lucide-react';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { getFormat } from 'campaign-link/formats/registry';
import { Select, type SelectOption } from 'campaign-link/ui/common/Select';
import { useState } from 'react';
import { findCopy } from '../../domain/compendium/fromCompendium';
import { COMPENDIUM_FILES } from '../../domain/compendium/types';
import { useCharacters } from '../../state/characterStore';
import { libraryCopy } from '../../state/compendium';
import { useUi } from '../../state/uiStore';
import { Modal } from '../../../ui/Modal';
import { CompendiumList } from './CompendiumList';

const FORMATS: SelectOption<FormatId>[] = (Object.keys(COMPENDIUM_FILES) as FormatId[]).map((id) => ({ value: id, label: getFormat(id).name }));

export function CompendiumModal() {
  const { closeModal, openModal, notify } = useUi.getState();
  const templates = useCharacters((s) => s.templates);
  const [formatId, setFormatId] = useState<FormatId>(FORMATS[0].value);

  return (
    <Modal title="Creatures from the SRD" onClose={closeModal}>
      <div className="character-editor">
        <div className="row">
          <span className="muted">Game system</span>
          <Select value={formatId} options={FORMATS} onChange={(id) => setFormatId(id)} />
        </div>
        <CompendiumList
          formatId={formatId}
          action={(entry) => {
            const copy = findCopy(templates, formatId, entry.id);
            if (copy) {
              return (
                <>
                  <span className="muted" title="Already in your characters">
                    <Check size={14} />
                  </span>
                  <button className="icon" title="Edit your copy" onClick={() => openModal({ type: 'editCharacter', templateId: copy.id })}>
                    <Pencil size={16} />
                  </button>
                </>
              );
            }
            return (
              <button
                className="icon"
                title="Copy to your characters"
                onClick={() => {
                  libraryCopy(entry, formatId);
                  notify('info', `${entry.name} is in your characters now, tagged SRD.`);
                }}
              >
                <Copy size={16} />
              </button>
            );
          }}
        />
      </div>
    </Modal>
  );
}
