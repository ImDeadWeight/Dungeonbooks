/**
 * @file Are-you-sure dialog for destructive actions, and a helper to open it.
 */
import { useUi } from '../../state/uiStore';
import { Modal } from './Modal';

/** Props for ConfirmDialog. */
interface Props {
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

/** Cancel / confirm dialog; the confirm button is red. */
export function ConfirmDialog({ title = 'Are you sure?', message, confirmLabel, cancelLabel = 'Cancel', onConfirm }: Props) {
  const close = useUi((s) => s.closeModal);
  return (
    <Modal
      title={title}
      size="small"
      onClose={close}
      footer={
        <>
          <button onClick={close}>{cancelLabel}</button>
          <button
            className="damage"
            onClick={() => {
              close();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}

/** Opens a confirmation dialog for destructive actions. */
export function confirmThen(message: string, confirmLabel: string, onConfirm: () => void) {
  useUi.getState().openModal({ type: 'confirm', message, confirmLabel, onConfirm });
}
