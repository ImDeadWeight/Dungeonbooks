/**
 * @file Library store: the list of notebooks and which one is open. Saved to
 * library.json by persistence.ts; notebooks.ts holds the actions that also
 * touch notebook files (create, switch, delete, import, export).
 */
import { create } from 'zustand';
import type { Id } from '../domain/ids';
import { emptyLibrary, type Library, type NotebookInfo } from '../domain/library';

/** Library data plus its actions. */
interface LibraryState extends Library {
  /** Replaces everything (used when loading). */
  replaceAll(library: Library): void;
  add(notebook: NotebookInfo): void;
  rename(id: Id, name: string): void;
  remove(id: Id): void;
  setActive(id: Id): void;
}

export const useLibrary = create<LibraryState>((set) => ({
  ...emptyLibrary(),
  replaceAll: (library) => set({ notebooks: library.notebooks, activeId: library.activeId }),
  add: (notebook) => set((s) => ({ notebooks: [...s.notebooks, notebook] })),
  rename: (id, name) => set((s) => ({ notebooks: s.notebooks.map((n) => (n.id === id ? { ...n, name } : n)) })),
  remove: (id) => set((s) => ({ notebooks: s.notebooks.filter((n) => n.id !== id) })),
  setActive: (id) => set({ activeId: id }),
}));
