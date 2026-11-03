/**
 * @file The Conditions window: every format's built-in conditions (read-only)
 * and the user's custom conditions, with create, edit and delete.
 */
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { ConditionDef } from '../../domain/conditions';
import { FORMAT_LIST } from 'campaign-link/formats/registry';
import { useCharacters } from '../../state/characterStore';
import { useUi } from '../../state/uiStore';
import { confirmThen } from '../common/ConfirmDialog';
import { Modal } from '../common/Modal';
import './conditions.css';

/** One condition with its rules text; custom ones get edit/delete buttons. */
function ConditionEntry({ def, onEdit, onDelete }: { def: ConditionDef; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="condition-entry">
      <div className="row">
        <strong className="spacer">{def.name}</strong>
        {def.valued && <span className="chip" title="Carries a number, e.g. Frightened 2">Value</span>}
        {def.dropsEachTurn && <span className="chip" title="The value drops by 1 at the end of the creature's turn">Drops each turn</span>}
        {def.repeatsSave && <span className="chip" title="Must be resolved before Next Turn">Force resolve</span>}
        {onEdit && (
          <button className="icon" title="Edit" onClick={onEdit}>
            <Pencil size={16} />
          </button>
        )}
        {onDelete && (
          <button className="icon" title="Delete" onClick={onDelete}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {def.effect && <p>{def.effect}</p>}
      {def.endsWhen && <p className="muted">Ends: {def.endsWhen}</p>}
    </div>
  );
}

/** Lists custom and built-in conditions per format. */
export function ConditionLibrary() {
  const customs = useCharacters((s) => s.customConditions);
  const { closeModal, openModal } = useUi.getState();

  // Delete a custom condition after confirming.
  const remove = (def: ConditionDef) =>
    confirmThen(
      `Delete the custom condition "${def.name}"? Characters that already have it keep it until it's removed.`,
      'Delete condition',
      () => useCharacters.getState().deleteCustomCondition(def.id),
    );

  return (
    <Modal title="Conditions" size="medium" onClose={closeModal}>
      <div className="condition-library">
        <div className="row">
          <span className="muted spacer">Custom conditions appear in the condition picker for every character of their format.</span>
          <button className="primary" onClick={() => openModal({ type: 'editCondition', conditionId: null })}>
            <Plus size={16} /> New condition
          </button>
        </div>
        {FORMAT_LIST.map((f) => {
          const mine = customs.filter((c) => c.formatId === f.id);
          return (
            <section key={f.id}>
              <h3>{f.name}: custom</h3>
              {mine.length === 0 && <p className="muted">None yet.</p>}
              {mine.map((c) => (
                <ConditionEntry
                  key={c.id}
                  def={c}
                  onEdit={() => openModal({ type: 'editCondition', conditionId: c.id })}
                  onDelete={() => remove(c)}
                />
              ))}
              <h3>{f.name}: built-in</h3>
              {f.conditions.map((c) => <ConditionEntry key={c.id} def={c} />)}
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
