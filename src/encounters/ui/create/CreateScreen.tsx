/**
 * @file The single Create dialog: pick what to create (area, encounter,
 * character) and fill in its form. Campaigns are made from the campaign menu.
 */
import { useState } from 'react';
import { activeCampaignId } from '../../../campaigns/campaignStore';
import { useCampaignFormat } from '../../state/libraryStore';
import { useUi, type CreateKind, type CreatePreset } from '../../state/uiStore';
import { CharacterEditor } from '../characters/CharacterEditor';
import { Modal } from '../../../ui/Modal';
import { closeUnlessDirty } from '../common/unsavedChanges';
import { EncounterForm } from './EncounterForm';
import { AreaForm } from './SimpleForms';
import './create.css';

/** Button labels for each kind. */
const KIND_LABELS: Record<CreateKind, string> = {
  area: 'Area',
  encounter: 'Encounter',
  character: 'Character',
};
/** Every kind, in button order. */
const ALL_KINDS = Object.keys(KIND_LABELS) as CreateKind[];

/**
 * One screen for creating anything. The big + opens it blank; inline +
 * buttons pre-select the kind and parents and restrict the choices.
 */
export function CreateScreen({ preset }: { preset: CreatePreset }) {
  const closeModal = useUi((s) => s.closeModal);
  const kinds = preset.allowedKinds ?? ALL_KINDS;
  const [kind, setKind] = useState<CreateKind | null>(preset.kind);
  // Into the open campaign unless an inline + said otherwise.
  const [campaignId] = useState(() => preset.campaignId ?? activeCampaignId());
  const defaultFormatId = useCampaignFormat(campaignId);
  // Whether the open form has unsaved input; each form reports it.
  const [dirty, setDirty] = useState(false);

  return (
    <Modal title="Create" onClose={() => closeUnlessDirty(dirty, closeModal)}>
      <div className="create-screen">
        <div className="kind-switch">
          <span className="muted">What are you creating?</span>
          {kinds.map((k) => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
        {kind === 'area' && <AreaForm campaignId={campaignId} parentAreaId={preset.areaId ?? null} onDirtyChange={setDirty} />}
        {kind === 'encounter' && <EncounterForm campaignId={campaignId} areaId={preset.areaId ?? null} onDirtyChange={setDirty} />}
        {kind === 'character' && <CharacterEditor templateId={null} defaultFormatId={defaultFormatId} onDone={closeModal} onDirtyChange={setDirty} />}
      </div>
    </Modal>
  );
}
