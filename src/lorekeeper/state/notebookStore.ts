/**
 * @file Notebook store: folders, pages and text boxes, with every edit the UI
 * can make. Saved to notebook.json by persistence.ts.
 */
import type { JSONContent } from '@tiptap/core';
import type { SharedStatBlock } from 'campaign-link';
import { create } from 'zustand';
import { newId, type Id } from '../domain/ids';
import {
  canMoveFolder,
  descendantFolderIds,
  emptyNotebook,
  placeFolder,
  type Notebook,
  type Page,
  type PageInfo,
  type TextBox,
} from '../domain/notebook';

/** A page with its info replaced (removed entirely when it becomes a plain note). */
function withInfo(page: Page, info: PageInfo | undefined): Page {
  const { info: _old, ...rest } = page;
  return info ? { ...rest, info } : rest;
}

/** Places inside a page that no longer exists (or is no longer a place) move to the top of the place tree. */
function dropDanglingParents(pages: Page[]): Page[] {
  const places = new Set(pages.filter((p) => p.info?.type === 'place').map((p) => p.id));
  return pages.map((p) =>
    p.info?.type === 'place' && p.info.parentPlaceId && !places.has(p.info.parentPlaceId)
      ? withInfo(p, { ...p.info, parentPlaceId: null })
      : p,
  );
}

/** Title given to new pages until the user names them. */
export const NEW_PAGE_TITLE = 'Untitled page';
/** Width of a new text box (px). */
const NEW_BOX_WIDTH = 360;

/** Notebook data plus its actions. */
interface NotebookState extends Notebook {
  /** Replaces everything (used when loading). */
  replaceAll(notebook: Notebook): void;
  addFolder(parentId: Id | null, name?: string): Id;
  renameFolder(id: Id, name: string): void;
  /** Moves a folder to the end of another folder (or the top level). Ignored when the move would put a folder inside itself. */
  moveFolder(id: Id, parentId: Id | null): void;
  /** Puts a folder at `index` among the folders in `parentId`. Ignored when the move would put a folder inside itself. */
  placeFolder(id: Id, parentId: Id | null, index: number): void;
  /** Deletes the folder with every folder and page inside it. */
  deleteFolder(id: Id): void;
  addPage(folderId: Id | null, title?: string): Id;
  renamePage(id: Id, title: string): void;
  movePage(id: Id, folderId: Id | null): void;
  /** Sets what pages describe (undefined makes them plain notes). */
  setPageInfo(ids: Id[], info: (current: PageInfo | undefined) => PageInfo | undefined): void;
  /** Gives a page a stat block, or removes it (undefined). */
  setPageStatBlock(id: Id, statBlock: SharedStatBlock | undefined): void;
  deletePage(id: Id): void;
  addBox(pageId: Id, x: number, y: number): Id;
  updateBox(pageId: Id, boxId: Id, patch: Partial<Omit<TextBox, 'id'>>): void;
  setBoxContent(pageId: Id, boxId: Id, content: JSONContent): void;
  deleteBox(pageId: Id, boxId: Id): void;
}

export const useNotebook = create<NotebookState>((set, get) => {
  /** Applies a change to one page's boxes. */
  const updateBoxes = (pageId: Id, change: (boxes: TextBox[]) => TextBox[]) =>
    set((s) => ({ pages: s.pages.map((p) => (p.id === pageId ? { ...p, boxes: change(p.boxes) } : p)) }));

  return {
    ...emptyNotebook(),

    replaceAll(notebook) {
      set({ folders: notebook.folders, pages: notebook.pages });
    },

    addFolder(parentId, name = 'New folder') {
      const id = newId();
      set((s) => ({ folders: [...s.folders, { id, name, parentId }] }));
      return id;
    },

    renameFolder(id, name) {
      set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)) }));
    },

    moveFolder(id, parentId) {
      const { folders } = get();
      if (!canMoveFolder(folders, id, parentId)) return;
      const end = folders.filter((f) => f.parentId === parentId && f.id !== id).length;
      set({ folders: placeFolder(folders, id, parentId, end) });
    },

    placeFolder(id, parentId, index) {
      const { folders } = get();
      if (!canMoveFolder(folders, id, parentId)) return;
      set({ folders: placeFolder(folders, id, parentId, index) });
    },

    deleteFolder(id) {
      const doomed = new Set([id, ...descendantFolderIds(get().folders, id)]);
      set((s) => ({
        folders: s.folders.filter((f) => !doomed.has(f.id)),
        pages: dropDanglingParents(s.pages.filter((p) => !p.folderId || !doomed.has(p.folderId))),
      }));
    },

    addPage(folderId, title = NEW_PAGE_TITLE) {
      const id = newId();
      set((s) => ({ pages: [...s.pages, { id, title, folderId, boxes: [] }] }));
      return id;
    },

    renamePage(id, title) {
      set((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, title } : p)) }));
    },

    movePage(id, folderId) {
      set((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, folderId } : p)) }));
    },

    setPageInfo(ids, info) {
      const chosen = new Set(ids);
      set((s) => ({ pages: dropDanglingParents(s.pages.map((p) => (chosen.has(p.id) ? withInfo(p, info(p.info)) : p))) }));
    },

    setPageStatBlock(id, statBlock) {
      set((s) => ({
        pages: s.pages.map((p) => {
          if (p.id !== id) return p;
          const { statBlock: _old, ...rest } = p;
          return statBlock ? { ...rest, statBlock } : rest;
        }),
      }));
    },

    deletePage(id) {
      set((s) => ({ pages: dropDanglingParents(s.pages.filter((p) => p.id !== id)) }));
    },

    addBox(pageId, x, y) {
      const id = newId();
      const box: TextBox = { id, x, y, width: NEW_BOX_WIDTH, content: { type: 'doc', content: [{ type: 'paragraph' }] } };
      updateBoxes(pageId, (boxes) => [...boxes, box]);
      return id;
    },

    updateBox(pageId, boxId, patch) {
      updateBoxes(pageId, (boxes) => boxes.map((b) => (b.id === boxId ? { ...b, ...patch } : b)));
    },

    setBoxContent(pageId, boxId, content) {
      updateBoxes(pageId, (boxes) => boxes.map((b) => (b.id === boxId ? { ...b, content } : b)));
    },

    deleteBox(pageId, boxId) {
      updateBoxes(pageId, (boxes) => boxes.filter((b) => b.id !== boxId));
    },
  };
});
