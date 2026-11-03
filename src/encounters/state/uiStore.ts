/**
 * @file UI store: what's selected, what's collapsed, the sidebar search, the
 * stack of open dialogs, and on-screen notices. Not saved; resets when the app
 * restarts.
 */
import { create } from 'zustand';
import type { FormatId } from 'campaign-link/formats/formatIds';
import type { Id } from '../domain/ids';
import type { TransferFile } from '../domain/transfer/types';
import { isPhoneLayout } from '../../platform';

/** Things the Create screen can make. */
export type CreateKind = 'area' | 'encounter' | 'character';

/** What the Create screen opens with; inline plus buttons pre-fill parents. */
export interface CreatePreset {
  /** Pre-selected kind, or null to let the user pick. */
  kind: CreateKind | null;
  /** Restricts the kind selector (e.g. a campaign's plus offers area/encounter only). */
  allowedKinds?: CreateKind[];
  campaignId?: Id | null;
  areaId?: Id | null;
}

/** Every dialog the app can show, with the data each one needs. Rendered by ModalHost. */
export type Modal =
  | { type: 'create'; preset: CreatePreset }
  | { type: 'characters' }
  | { type: 'conditions' }
  | { type: 'editCondition'; conditionId: Id | null }
  | { type: 'editCharacter'; templateId: Id | null; defaultFormatId?: FormatId | null }
  | { type: 'addToEncounter'; encounterId: Id }
  | { type: 'editTreeItem'; kind: 'area' | 'encounter'; id: Id }
  | { type: 'importPreview'; file: TransferFile }
  | { type: 'confirm'; title?: string; message: string; confirmLabel: string; cancelLabel?: string; onConfirm: () => void };

/** A message shown at the bottom of the screen. Info notices fade; errors stay until dismissed. */
export interface Notice {
  id: number;
  tone: 'info' | 'error';
  text: string;
}

/** UI state plus its actions. */
interface UiState {
  /** Encounter shown in the main panel. */
  selectedEncounterId: Id | null;
  /** Remembered per encounter so switching encounters loses nothing. */
  selectedCombatant: Record<Id, Id | null>;
  sidebarCollapsed: boolean;
  /**
   * Phones only: the combatant panel is showing in place of the initiative
   * order. Set by tapping a combatant, not by turns moving on (which also
   * select whoever's turn it is).
   */
  detailsOpen: boolean;
  /** Tree nodes (campaigns/areas) the user has collapsed; expanded by default. */
  collapsedNodes: Record<Id, boolean>;
  /** The sidebar's search text; blank shows the whole tree. */
  sidebarSearch: string;
  /** Tree nodes opened or closed by hand during the current search (on top of what the search opens). */
  searchToggled: Record<Id, boolean>;
  /** Open dialogs, bottom to top; only the top one is interactive. */
  modals: Modal[];
  notices: Notice[];
  /** Shows an encounter in the main panel. */
  selectEncounter(id: Id | null): void;
  /** Shows a combatant in the right panel (remembered per encounter). */
  selectCombatant(encounterId: Id, combatantId: Id | null): void;
  /** The user tapped a combatant: select it and, on a phone, show its panel. */
  openCombatant(encounterId: Id, combatantId: Id): void;
  /** Phones: back from the combatant panel to the initiative order. */
  closeDetails(): void;
  /** Collapses or expands the left panel. */
  toggleSidebar(): void;
  /** Flips a tree node between collapsed and expanded. */
  toggleNode(id: Id): void;
  /** Changes the sidebar search, forgetting nodes toggled during the last one. */
  setSidebarSearch(text: string): void;
  /** Opens or closes a tree node for the current search only. */
  toggleSearchNode(id: Id): void;
  /** Opens a dialog on top of any already open. */
  openModal(m: Modal): void;
  /** Closes the top dialog. */
  closeModal(): void;
  /** Shows a notice. */
  notify(tone: Notice['tone'], text: string): void;
  /** Removes a notice. */
  dismissNotice(id: number): void;
}

/** Counter for notice ids. */
let noticeSeq = 0;

/** The UI store hook. */
export const useUi = create<UiState>((set) => ({
  selectedEncounterId: null,
  selectedCombatant: {},
  sidebarCollapsed: false,
  detailsOpen: false,
  collapsedNodes: {},
  sidebarSearch: '',
  searchToggled: {},
  modals: [],
  notices: [],
  // On a phone the encounter replaces the sidebar, so opening one folds the sidebar away.
  selectEncounter: (id) => set({ selectedEncounterId: id, detailsOpen: false, ...(id && isPhoneLayout() ? { sidebarCollapsed: true } : {}) }),
  selectCombatant: (encounterId, combatantId) =>
    set((s) => ({ selectedCombatant: { ...s.selectedCombatant, [encounterId]: combatantId } })),
  openCombatant: (encounterId, combatantId) =>
    set((s) => ({ selectedCombatant: { ...s.selectedCombatant, [encounterId]: combatantId }, detailsOpen: true })),
  closeDetails: () => set({ detailsOpen: false }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleNode: (id) => set((s) => ({ collapsedNodes: { ...s.collapsedNodes, [id]: !s.collapsedNodes[id] } })),
  setSidebarSearch: (text) => set({ sidebarSearch: text, searchToggled: {} }),
  toggleSearchNode: (id) => set((s) => ({ searchToggled: { ...s.searchToggled, [id]: !s.searchToggled[id] } })),
  openModal: (m) => set((s) => ({ modals: [...s.modals, m] })),
  closeModal: () => set((s) => ({ modals: s.modals.slice(0, -1) })),
  notify: (tone, text) => set((s) => ({ notices: [...s.notices, { id: ++noticeSeq, tone, text }] })),
  dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));
