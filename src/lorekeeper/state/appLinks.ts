/**
 * @file Links between the tabs: opening an encounter or character in the
 * Encounters tab, and opening a page here (switching notebooks if needed)
 * when the Encounters tab asks for one.
 */
import type { LinkTarget } from 'campaign-link';
import { openTarget, registerOpener } from '../../bridge/navigation';
import { useLibrary } from './libraryStore';
import { useNotebook } from './notebookStore';
import { switchNotebook } from './notebooks';
import { useUi } from './uiStore';

/** Opens an encounter or character in the Encounters tab. */
export function openInEncounters(target: Extract<LinkTarget, { app: 'encounters' }>): void {
  openTarget(target);
}

/** Opens the page a link points at, switching notebooks if needed. */
async function handle(target: LinkTarget) {
  if (target.kind !== 'page') return;
  const ui = useUi.getState();
  if (!useLibrary.getState().notebooks.some((n) => n.id === target.notebookId)) {
    ui.notifyError('The notebook that page was in no longer exists.');
    return;
  }
  await switchNotebook(target.notebookId);
  if (useLibrary.getState().activeId !== target.notebookId) return; // switching failed and said why
  if (useNotebook.getState().pages.some((p) => p.id === target.pageId)) ui.selectPage(target.pageId);
  else ui.notifyError('That page no longer exists.');
}

/** Lets the Encounters tab open pages here. */
export function startAppLinks(): void {
  registerOpener('lorekeeper', (target) => {
    handle(target);
  });
}
