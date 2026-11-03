/**
 * @file What the notebook menu can do: create, switch, rename, delete,
 * import and export notebooks. Failures show as error notices.
 */
import { newId, type Id } from '../domain/ids';
import { exportFileName, exportText, NEW_NOTEBOOK_NAME, parseNotebookFile, uniqueName } from '../domain/library';
import { emptyNotebook, type Notebook } from '../domain/notebook';
import { openFile, saveFileAs } from '../storage/files';
import { useLibrary } from './libraryStore';
import { useNotebook } from './notebookStore';
import { deleteNotebookFile, forgetView, openNotebook, readNotebook, writeNotebook } from './persistence';
import { useUi } from './uiStore';

const notify = (what: string, err: unknown) => useUi.getState().notifyError(`${what}: ${(err as Error).message}`);
const takenNames = () => useLibrary.getState().notebooks.map((n) => n.name);

/** Saves a new notebook's file, lists it, and opens it. Returns its id. */
async function addNotebook(name: string, notebook: Notebook): Promise<Id> {
  const id = newId();
  // File first, so the list never names a notebook that has no file.
  await writeNotebook(id, notebook);
  useLibrary.getState().add({ id, name: uniqueName(takenNames(), name) });
  await openNotebook(id);
  return id;
}

/** Opens another notebook. */
export async function switchNotebook(id: Id): Promise<void> {
  if (id === useLibrary.getState().activeId) return;
  try {
    await openNotebook(id);
  } catch (err) {
    notify('Could not open that notebook', err);
  }
}

/** Creates an empty notebook and opens it. Returns its id, or null if that failed. */
export async function createNotebook(): Promise<Id | null> {
  try {
    return await addNotebook(NEW_NOTEBOOK_NAME, emptyNotebook());
  } catch (err) {
    notify('Could not create a notebook', err);
    return null;
  }
}

/** Renames a notebook; blank names are ignored. */
export function renameNotebook(id: Id, name: string): void {
  if (name.trim()) useLibrary.getState().rename(id, name.trim());
}

/** Deletes a notebook and its file. The open one is swapped for another first (a new one if it was the last). */
export async function deleteNotebook(id: Id): Promise<void> {
  try {
    const { notebooks, activeId } = useLibrary.getState();
    if (id === activeId) {
      const other = notebooks.find((n) => n.id !== id);
      if (other) await openNotebook(other.id);
      else await addNotebook(NEW_NOTEBOOK_NAME, emptyNotebook());
    }
    useLibrary.getState().remove(id);
    await deleteNotebookFile(id);
    await forgetView(id);
  } catch (err) {
    notify('Could not delete the notebook', err);
  }
}

/** Asks where to save, then writes the notebook as one self-contained file. */
export async function exportNotebook(id: Id): Promise<void> {
  try {
    const info = useLibrary.getState().notebooks.find((n) => n.id === id);
    if (!info) return;
    const { folders, pages } = useNotebook.getState();
    const notebook = id === useLibrary.getState().activeId ? { folders, pages } : await readNotebook(id);
    await saveFileAs(exportFileName(info.name), exportText(info.name, notebook));
  } catch (err) {
    notify('Could not export the notebook', err);
  }
}

/** Asks for an exported notebook file, adds it as a new notebook (never replacing one), and opens it. */
export async function importNotebook(): Promise<void> {
  try {
    const file = await openFile();
    if (!file) return;
    const { name, notebook } = parseNotebookFile(file.text, file.baseName);
    await addNotebook(name, notebook);
  } catch (err) {
    notify('Could not import that file', err);
  }
}
