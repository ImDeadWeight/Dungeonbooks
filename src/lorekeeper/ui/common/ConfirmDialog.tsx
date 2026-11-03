/**
 * @file Are-you-sure dialog for destructive actions (shown while the UI store
 * holds a pending confirmation).
 */
import { useUi } from '../../state/uiStore';
import { Modal } from './Modal';

/** Cancel / confirm dialog; the confirm button is red. */
export function ConfirmDialog() {
  const confirm = useUi((s) => s.confirm);
  const close = useUi((s) => s.closeConfirm);
  if (!confirm) return null;
  return (
    <Modal
      title="Are you sure?"
      size="small"
      onClose={close}
      footer={
        <>
          <button onClick={close}>Cancel</button>
          <button
            className="damage"
            autoFocus
            onClick={() => {
              close();
              confirm.onConfirm();
            }}
          >
            {confirm.confirmLabel}
          </button>
        </>
      }
    >
      <p>{confirm.message}</p>
    </Modal>
  );
}
