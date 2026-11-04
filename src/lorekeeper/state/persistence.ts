/**
 * @file Connects the stores to their files: one notebook-<campaign id>.json
 * per campaign (its notes) and view.json (each notebook's collapsed folders).
 * Loads the open campaign's notebook at startup, then saves shortly after each
 * change. A campaign with no notebook file yet has empty notes.
 */
import { useCampaigns } from '../../campaigns/campaignStore';
import type { Id } from '../domain/ids';
import { emptyNotebook, NOTEBOOK_FORMAT, type Notebook } from '../domain/notebook';
import { upgradeNotebook } from '../domain/upgrade';
import { loadDocument, removeDocument, saveDocument } from '../storage/documents';
import { useNotebook } from './notebookStore';
import { useUi } from './uiStore';

/** Wait this long after the last change before writing, so typing saves once per pause. */
const SAVE_DELAY_MS = 500;
/** How each notebook was last shown; kept apart from the notebooks so exports don't carry it. */
const VIEW = 'view';

/** How a notebook was last shown in the sidebar. */
interface NotebookView {
  /** Collapsed folders, and collapsed pages that have pages under them. */
  collapsedFolders: Id[];
}

/** Every notebook's view, by campaign id. */
let views: Record<Id, NotebookView> = {};
/** Pending save of view.json. */
let viewTimer: ReturnType<typeof setTimeout> | undefined;

/** A campaign's notebook document name. */
const notebookDoc = (id: Id) => `notebook-${id}`;

/** The campaign whose notes are in the notebook store (where its edits get saved). */
let openId: Id | null = null;
/** Pending save of the open notebook. */
let timer: ReturnType<typeof setTimeout> | undefined;
/** True while a notebook is being loaded into the store, so loading doesn't count as an edit. */
let swapping = false;

/** Writes run one at a time, so two saves of a file can't interleave. */
let writes: Promise<unknown> = Promise.resolve();
function serially<T>(task: () => Promise<T>): Promise<T> {
  const run = writes.then(task, task);
  writes = run.catch(() => undefined);
  return run;
}

const notify = (what: string) => (err: unknown) => useUi.getState().notifyError(`${what}: ${(err as Error).message}`);

/** Saves a campaign's notes to its file. */
export function writeNotebook(id: Id, notebook: Notebook): Promise<void> {
  return serially(() => saveDocument(notebookDoc(id), notebook));
}

/** Deletes a campaign's notes file. */
export function deleteNotebookFile(id: Id): Promise<void> {
  return serially(() => removeDocument(notebookDoc(id)));
}

/**
 * Reads a campaign's notes from its file (empty if it has none). Notes saved
 * by an older version are upgraded and saved that way, after a copy of them
 * as they were is kept as notebook-<id>.before-format-<n>.
 */
export async function readNotebook(id: Id): Promise<Notebook> {
  const loaded = await loadDocument(notebookDoc(id), emptyNotebook);
  if (loaded.warning) useUi.getState().notifyError(loaded.warning);
  const notebook = upgradeNotebook(loaded.data);
  if (notebook !== loaded.data) {
    if (loaded.data.pages.length || loaded.data.folders.length) {
      await serially(() => saveDocument(`${notebookDoc(id)}.before-format-${NOTEBOOK_FORMAT}`, loaded.data));
    }
    await writeNotebook(id, notebook);
  }
  return notebook;
}

/** The open notes, as saved. */
export function openNotebookContents(): Notebook {
  const { folders, pages } = useNotebook.getState();
  return { format: NOTEBOOK_FORMAT, folders, pages };
}

/** Saves the open notebook now (cancelling the pending save). Rejects if the write fails. */
export function saveOpenNotebook(): Promise<void> {
  clearTimeout(timer);
  timer = undefined;
  if (!openId) return Promise.resolve();
  return writeNotebook(openId, openNotebookContents());
}

/**
 * Loads a campaign's notes into the store: saves the current notes' pending
 * edits first (and rejects, leaving them open, if that fails).
 */
export async function openNotebook(id: Id): Promise<void> {
  if (timer !== undefined) await saveOpenNotebook();
  const notebook = await readNotebook(id);
  swapping = true;
  try {
    openId = id;
    useNotebook.getState().replaceAll(notebook);
  } finally {
    swapping = false;
  }
  const collapsed = Object.fromEntries((views[id]?.collapsedFolders ?? []).map((folderId) => [folderId, true]));
  useUi.getState().resetForNotebook(collapsed);
}

/** Saves view.json now (cancelling the pending save). */
function saveViews(): Promise<void> {
  clearTimeout(viewTimer);
  viewTimer = undefined;
  return serially(() => saveDocument(VIEW, views));
}

/** Records the open notebook's collapsed folders and pages (ignoring deleted ones) and saves them shortly. */
function rememberView(collapsedFolders: Record<Id, boolean>) {
  if (!openId) return;
  const { folders, pages } = useNotebook.getState();
  const existing = new Set([...folders.map((f) => f.id), ...pages.map((p) => p.id)]);
  const collapsed = Object.keys(collapsedFolders).filter((id) => collapsedFolders[id] && existing.has(id));
  views = { ...views, [openId]: { collapsedFolders: collapsed } };
  clearTimeout(viewTimer);
  viewTimer = setTimeout(() => saveViews().catch(notify('Could not save which folders are open')), SAVE_DELAY_MS);
}

/** Forgets a deleted campaign's view. */
export function forgetView(id: Id): Promise<void> {
  const { [id]: _gone, ...rest } = views;
  views = rest;
  return saveViews();
}

/** Loads the open campaign's notes, then saves them (and the view) whenever they change. Load after the campaign list. */
export async function startPersistence(): Promise<void> {
  const view = await loadDocument<Record<Id, NotebookView>>(VIEW, () => ({}));
  if (view.warning) useUi.getState().notifyError(view.warning);
  views = view.data;
  await openNotebook(useCampaigns.getState().activeId!);

  useNotebook.subscribe(() => {
    if (swapping) return;
    clearTimeout(timer);
    timer = setTimeout(() => saveOpenNotebook().catch(notify('Could not save notebook')), SAVE_DELAY_MS);
  });
  useUi.subscribe((ui, before) => {
    if (ui.collapsedFolders !== before.collapsedFolders) rememberView(ui.collapsedFolders);
  });
  // Don't lose the last half-second of typing (or folding) when the window closes.
  window.addEventListener('beforeunload', () => {
    if (timer !== undefined) saveOpenNotebook().catch(notify('Could not save notebook'));
    if (viewTimer !== undefined) saveViews().catch(notify('Could not save which folders are open'));
  });
}
