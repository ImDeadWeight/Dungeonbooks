/**
 * @file What clicking a page's name in a list does: peek at it next to the
 * name, or open it with Ctrl.
 */
import type { MouseEvent } from 'react';
import type { Id } from '../../domain/ids';
import { useUi } from '../../state/uiStore';

/** Peeks at a page next to the clicked name, or opens it with Ctrl. */
export function showPage(e: MouseEvent, pageId: Id) {
  const ui = useUi.getState();
  if (e.ctrlKey || e.metaKey) ui.selectPage(pageId);
  else ui.openPeek({ pageId, x: e.clientX, y: e.clientY });
}
