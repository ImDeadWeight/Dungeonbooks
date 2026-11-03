/**
 * @file Dialog for adding characters to an existing encounter, using the same
 * cart as encounter creation.
 */
import { assignSideInitiative } from '../../domain/combat/initiative';
import { addToCombatants } from '../../domain/library/combatantFactory';
import type { Id } from '../../domain/ids';
import { useCharacters } from '../../state/characterStore';
import { runCombatAction } from '../../state/combatStore';
import { useEncounter } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';
import { Modal } from '../common/Modal';
import { closeUnlessDirty } from '../common/unsavedChanges';
import { CartBuilder } from './CartBuilder';
import { useCart } from './useCart';
import './create.css';

/**
 * Adds characters to an existing encounter. During active combat the new
 * combatants have no initiative, which makes the initiative prompt appear.
 */
export function AddToEncounter({ encounterId }: { encounterId: Id }) {
  const encounter = useEncounter(encounterId);
  const closeModal = useUi((s) => s.closeModal);
  const cart = useCart();
  if (!encounter) return null;
  // Picked characters not yet added count as unsaved changes.
  const cancel = () => closeUnlessDirty(cart.lines.length > 0, closeModal);

  // Add the cart to the encounter (logged for undo during combat).
  const add = () => {
    const lookup = (id: string) => useCharacters.getState().templates.find((t) => t.id === id);
    runCombatAction(encounterId, 'Add characters', (enc, rules) => {
      const added = { ...enc, combatants: addToCombatants(enc.combatants, cart.lines, lookup, enc.formatId) };
      // Side initiative: newcomers join their side's roll instead of being prompted.
      return enc.combat.active ? assignSideInitiative(added, rules) : added;
    });
    closeModal();
  };

  return (
    <Modal
      title={`Add characters to ${encounter.name}`}
      onClose={cancel}
      footer={
        <>
          <button onClick={cancel}>Cancel</button>
          <button className="primary" disabled={cart.lines.length === 0} onClick={add}>Add to encounter</button>
        </>
      }
    >
      <div className="create-screen">
        <CartBuilder cart={cart} alreadyIn={encounter.combatants.map((c) => c.templateId)} formatId={encounter.formatId} />
      </div>
    </Modal>
  );
}
