/**
 * @file UI store: the open page, collapsed folders, the sidebar search, the
 * stat block panel, the link peek panel, the confirmation dialog and error
 * notices. Only the collapsed folders are saved
 * (per notebook, by persistence.ts); the rest resets on restart.
 */
import { create } from 'zustand';
import type { Id } from '../domain/ids';
import { isPhoneLayout } from '../../platform';

/** Recently opened pages remembered. */
const MAX_RECENT = 20;

/** The small panel that shows a linked page without leaving the current one. */
export interface Peek {
  pageId: Id;
  /** Screen position the panel opens next to (the clicked link). */
  x: number;
  y: number;
  /** Removes the link that was clicked; absent when opened from inside another peek. */
  unlink?: () => void;
}

/** An are-you-sure prompt for destructive actions. */
export interface Confirm {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

/** UI state plus its actions. */
interface UiState {
  selectedPageId: Id | null;
  /** Pages opened lately, most recent first (link suggestions rank them higher). */
  recentPageIds: Id[];
  /** Folders the user has collapsed; expanded by default. */
  collapsedFolders: Record<Id, boolean>;
  sidebarCollapsed: boolean;
  /** The stat block panel beside Character pages is showing. */
  statBlockOpen: boolean;
  /** The sidebar's search text; blank shows the whole tree. */
  sidebarSearch: string;
  /** Folders opened or closed by hand during the current search (on top of what the search opens). */
  searchToggled: Record<Id, boolean>;
  /** Text box that should take focus once it mounts (a box just created by clicking the canvas). */
  focusBoxId: Id | null;
  /** Page whose title field should take focus (a page just created). */
  focusTitlePageId: Id | null;
  peek: Peek | null;
  confirm: Confirm | null;
  /** Folder whose pages the set-page-type dialog is open for. */
  pageTypeFolderId: Id | null;
  errors: string[];
  selectPage(id: Id | null): void;
  toggleFolder(id: Id): void;
  /** Expands a folder (e.g. when something is created inside it). */
  expandFolder(id: Id): void;
  toggleSidebar(): void;
  toggleStatBlock(): void;
  /** Changes the sidebar search, forgetting folders toggled during the last one. */
  setSidebarSearch(text: string): void;
  /** Opens or closes a folder for the current search only. */
  toggleSearchFolder(id: Id): void;
  setFocusBox(id: Id | null): void;
  setFocusTitle(id: Id | null): void;
  openPeek(peek: Peek): void;
  closePeek(): void;
  askConfirm(confirm: Confirm): void;
  closeConfirm(): void;
  setPageTypeFolder(id: Id | null): void;
  notifyError(text: string): void;
  dismissError(index: number): void;
  /** Forgets the open page and peek, which belonged to the notebook that was open, and shows its remembered folds. */
  resetForNotebook(collapsedFolders: Record<Id, boolean>): void;
}

export const useUi = create<UiState>((set) => ({
  selectedPageId: null,
  recentPageIds: [],
  collapsedFolders: {},
  sidebarCollapsed: false,
  statBlockOpen: false,
  sidebarSearch: '',
  searchToggled: {},
  focusBoxId: null,
  focusTitlePageId: null,
  peek: null,
  confirm: null,
  pageTypeFolderId: null,
  errors: [],
  // On a phone the page replaces the page list, so opening one folds the list away.
  selectPage: (id) =>
    set((s) => ({
      selectedPageId: id,
      peek: null,
      recentPageIds: id ? [id, ...s.recentPageIds.filter((r) => r !== id)].slice(0, MAX_RECENT) : s.recentPageIds,
      ...(id && isPhoneLayout() ? { sidebarCollapsed: true } : {}),
    })),
  toggleFolder: (id) => set((s) => ({ collapsedFolders: { ...s.collapsedFolders, [id]: !s.collapsedFolders[id] } })),
  expandFolder: (id) => set((s) => ({ collapsedFolders: { ...s.collapsedFolders, [id]: false } })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleStatBlock: () => set((s) => ({ statBlockOpen: !s.statBlockOpen })),
  setSidebarSearch: (text) => set({ sidebarSearch: text, searchToggled: {} }),
  toggleSearchFolder: (id) => set((s) => ({ searchToggled: { ...s.searchToggled, [id]: !s.searchToggled[id] } })),
  setFocusBox: (id) => set({ focusBoxId: id }),
  setFocusTitle: (id) => set({ focusTitlePageId: id }),
  openPeek: (peek) => set({ peek }),
  closePeek: () => set({ peek: null }),
  askConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),
  setPageTypeFolder: (id) => set({ pageTypeFolderId: id }),
  notifyError: (text) => set((s) => ({ errors: [...s.errors, text] })),
  dismissError: (index) => set((s) => ({ errors: s.errors.filter((_, i) => i !== index) })),
  resetForNotebook: (collapsedFolders) =>
    set({ selectedPageId: null, recentPageIds: [], collapsedFolders, focusBoxId: null, focusTitlePageId: null, peek: null }),
}));
