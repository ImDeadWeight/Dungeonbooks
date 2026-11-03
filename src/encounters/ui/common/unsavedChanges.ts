/**
 * @file Unsaved-changes guard for edit windows: every way out (Cancel, the
 * close button, clicking the backdrop) goes through closeUnlessDirty, which
 * asks "Continue editing / Discard changes" when there are unsaved changes.
 */
import { useEffect } from 'react';
import { useUi } from '../../state/uiStore';

/** Runs `close` straight away if nothing changed; otherwise asks before discarding. */
export function closeUnlessDirty(dirty: boolean, close: () => void) {
  if (!dirty) {
    close();
    return;
  }
  useUi.getState().openModal({
    type: 'confirm',
    title: 'Unsaved changes',
    message: 'You have unsaved changes. Discard them?',
    cancelLabel: 'Continue editing',
    confirmLabel: 'Discard changes',
    onConfirm: close,
  });
}

/** Tells a wrapping window whether an embedded form has unsaved changes (reported on mount and on every change). */
export function useReportDirty(dirty: boolean, onDirtyChange?: (dirty: boolean) => void) {
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
}
