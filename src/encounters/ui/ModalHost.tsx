/**
 * @file Renders the stack of open dialogs from the UI store.
 */
import { useUi, type Modal } from '../state/uiStore';
import { CharacterLibrary, EditCharacterModal } from './characters/CharacterLibrary';
import { ConfirmDialog } from './common/ConfirmDialog';
import { ConditionEditor } from './conditions/ConditionEditor';
import { ConditionLibrary } from './conditions/ConditionLibrary';
import { AddToEncounter } from './create/AddToEncounter';
import { CreateScreen } from './create/CreateScreen';
import { EditCampaign, EditTreeItem } from './sidebar/EditTreeItem';
import { ImportPreview } from './transfer/ImportPreview';

/** The component for one dialog entry. */
function render(m: Modal) {
  switch (m.type) {
    case 'create':
      return <CreateScreen preset={m.preset} />;
    case 'characters':
      return <CharacterLibrary />;
    case 'conditions':
      return <ConditionLibrary />;
    case 'editCondition':
      return <ConditionEditor conditionId={m.conditionId} />;
    case 'editCharacter':
      return <EditCharacterModal templateId={m.templateId} defaultFormatId={m.defaultFormatId ?? null} />;
    case 'addToEncounter':
      return <AddToEncounter encounterId={m.encounterId} />;
    case 'editTreeItem':
      return m.kind === 'campaign' ? <EditCampaign id={m.id} /> : <EditTreeItem kind={m.kind} id={m.id} />;
    case 'importPreview':
      return <ImportPreview file={m.file} />;
    case 'confirm':
      return <ConfirmDialog title={m.title} message={m.message} confirmLabel={m.confirmLabel} cancelLabel={m.cancelLabel} onConfirm={m.onConfirm} />;
  }
}

/** Modals stack (e.g. "New character" opened from inside the encounter cart). */
export function ModalHost() {
  const modals = useUi((s) => s.modals);
  return (
    <>
      {modals.map((m, i) => (
        <div key={i}>{render(m)}</div>
      ))}
    </>
  );
}
