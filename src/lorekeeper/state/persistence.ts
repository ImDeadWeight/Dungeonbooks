/**
 * @file Connects the stores to their files: library.json (which notebooks
 * exist, which is open), one notebook-<id>.json per notebook, and view.json
 * (each notebook's collapsed folders). Loads them at startup, then saves
 * shortly after each change.
 */
import { newId, type Id } from '../domain/ids';
import { DEFAULT_NOTEBOOK_NAME, emptyLibrary, type Library } from '../domain/library';
import { emptyNotebook, type Notebook } from '../domain/notebook';
import { hasDocument, loadDocument, removeDocument, saveDocument } from '../storage/documents';
import { useLibrary } from './libraryStore';
import { useNotebook } from './notebookStore';
import { useUi } from './uiStore';

/** Wait this long after the last change before writing, so typing saves once per pause. */
const SAVE_DELAY_MS = 500;
/** The library's document. */
const LIBRARY = 'library';
/** The single notebook saved before there were several; adopted on first start. */
const LEGACY_NOTEBOOK = 'notebook';
/** How each notebook was last shown; kept apart from the notebooks so exports don't carry it. */
const VIEW = 'view';

/** How a notebook was last shown in the sidebar. */
interface NotebookView {
  collapsedFolders: Id[];
}

/** Every notebook's view, by notebook id. */
let views: Record<Id, NotebookView> = {};
/** Pending save of view.json. */
let viewTimer: ReturnType<typeof setTimeout> | undefined;

/** A notebook's document name. */
const notebookDoc = (id: Id) => `notebook-${id}`;

/** The notebook whose contents are in the notebook store (where its edits get saved). */
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

/** Saves a notebook's contents to its file. */
export function writeNotebook(id: Id, notebook: Notebook): Promise<void> {
  return serially(() => saveDocument(notebookDoc(id), notebook));
}

/** Deletes a notebook's file. */
export function deleteNotebookFile(id: Id): Promise<void> {
  return serially(() => removeDocument(notebookDoc(id)));
}

/** Reads a notebook's contents from its file (empty if it has none). */
export async function readNotebook(id: Id): Promise<Notebook> {
  const loaded = await loadDocument(notebookDoc(id), emptyNotebook);
  if (loaded.warning) useUi.getState().notifyError(loaded.warning);
  return loaded.data;
}

/** Saves the open notebook now (cancelling the pending save). Rejects if the write fails. */
export function saveOpenNotebook(): Promise<void> {
  clearTimeout(timer);
  timer = undefined;
  if (!openId) return Promise.resolve();
  const { folders, pages } = useNotebook.getState();
  return writeNotebook(openId, { folders, pages });
}

/**
 * Makes a notebook the open one: saves the current one's pending edits first
 * (and stays put if that fails), then loads the other into the store.
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
  useLibrary.getState().setActive(id);
}

/** Saves view.json now (cancelling the pending save). */
function saveViews(): Promise<void> {
  clearTimeout(viewTimer);
  viewTimer = undefined;
  return serially(() => saveDocument(VIEW, views));
}

/** Records the open notebook's collapsed folders (ignoring deleted ones) and saves them shortly. */
function rememberView(collapsedFolders: Record<Id, boolean>) {
  if (!openId) return;
  const existing = new Set(useNotebook.getState().folders.map((f) => f.id));
  const collapsed = Object.keys(collapsedFolders).filter((id) => collapsedFolders[id] && existing.has(id));
  views = { ...views, [openId]: { collapsedFolders: collapsed } };
  clearTimeout(viewTimer);
  viewTimer = setTimeout(() => saveViews().catch(notify('Could not save which folders are open')), SAVE_DELAY_MS);
}

/** Forgets a deleted notebook's view. */
export function forgetView(id: Id): Promise<void> {
  const { [id]: _gone, ...rest } = views;
  views = rest;
  return saveViews();
}

/**
 * The library on first start: the notebook saved before there were several,
 * if there is one (its old file stays as a backup), else an empty notebook.
 */
async function firstLibrary(): Promise<Library> {
  const id = newId();
  const legacy = (await hasDocument(LEGACY_NOTEBOOK)) ? await loadDocument(LEGACY_NOTEBOOK, emptyNotebook) : null;
  if (legacy?.warning) useUi.getState().notifyError(legacy.warning);
  await writeNotebook(id, legacy?.data ?? emptyNotebook());
  return { notebooks: [{ id, name: DEFAULT_NOTEBOOK_NAME }], activeId: id };
}

/** Loads the library and the open notebook, then saves each whenever it changes. */
export async function startPersistence(): Promise<void> {
  const loaded = await loadDocument(LIBRARY, emptyLibrary);
  if (loaded.warning) useUi.getState().notifyError(loaded.warning);
  let library = loaded.data;
  if (library.notebooks.length === 0) {
    library = await firstLibrary();
    await serially(() => saveDocument(LIBRARY, library));
  }
  useLibrary.getState().replaceAll(library);
  const view = await loadDocument<Record<Id, NotebookView>>(VIEW, () => ({}));
  if (view.warning) useUi.getState().notifyError(view.warning);
  views = view.data;
  const active = library.notebooks.find((n) => n.id === library.activeId) ?? library.notebooks[0];
  await openNotebook(active.id);

  useNotebook.subscribe(() => {
    if (swapping) return;
    clearTimeout(timer);
    timer = setTimeout(() => saveOpenNotebook().catch(notify('Could not save notebook')), SAVE_DELAY_MS);
  });
  useLibrary.subscribe(({ notebooks, activeId }) => {
    serially(() => saveDocument(LIBRARY, { notebooks, activeId })).catch(notify('Could not save the notebook list'));
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
