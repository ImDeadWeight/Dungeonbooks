/**
 * @file Link autocomplete. While typing, when the words just typed start the
 * name of one page, the rest of the word shows in grey after the caret; Tab
 * finishes the word and links the mention to that page (Escape hides it).
 * Typing [[ or pressing Ctrl+Space opens the link picker instead: a list of
 * pages that fit the words so far (typos forgiven), ending with a row that
 * creates a page by that name. Ctrl+Space with text selected links the
 * selection as it is. The list itself is drawn by LinkPicker.tsx.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { Id } from '../../domain/ids';
import {
  completionAt,
  restOfWordIn,
  searchablePages,
  searchPages,
  type PageResult,
  type SearchContext,
} from '../../domain/pageSearch';
import { useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';
import { isPhoneLayout } from '../../../platform';
import { PAGE_LINK } from './pageLink';

/** The grey rest of a word, offered after the caret. */
export interface Ghost {
  /** Where the mention starts (it can span several typed words). */
  from: number;
  /** The caret, where `rest` would go. */
  to: number;
  rest: string;
  pageId: Id;
}

/**
 * The open link picker. `brackets`: opened by typing [[ at `from`; the search
 * is what follows, and picking replaces it all with the page's name. `words`:
 * opened with Ctrl+Space; the search is the words from `from` to the caret,
 * which picking finishes and links (or replaces, when they only fit with
 * typos). `selection`: opened with text selected; picking links it as it is.
 */
export interface Picker {
  mode: 'brackets' | 'words' | 'selection';
  from: number;
  /** End of the selection (selection mode only; otherwise the caret is the end). */
  to: number;
  /** Highlighted row. */
  selected: number;
}

/** A row of the picker. */
export type PickerItem = { kind: 'page'; result: PageResult } | { kind: 'create'; title: string };

interface AutocompleteState {
  ghost: Ghost | null;
  picker: Picker | null;
  /** Start of a mention whose completion was dismissed with Escape: not offered again while typing it. */
  dismissedFrom: number | null;
}

type Action = { type: 'open'; picker: Picker } | { type: 'select'; index: number } | { type: 'close' } | { type: 'dismissGhost' };

const pluginKey = new PluginKey<AutocompleteState>('linkAutocomplete');

/** The longest search the picker keeps open for (past this, [[ was probably just text). */
const MAX_QUERY = 60;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** The autocomplete state of an editor. */
export function autocompleteState(state: EditorState): AutocompleteState | undefined {
  return pluginKey.getState(state);
}

/** What ranks the results: the page being edited, its folder, and the pages opened lately. */
function searchContext(pageId: Id): SearchContext {
  const page = useNotebook.getState().pages.find((p) => p.id === pageId);
  return { currentPageId: pageId, folderId: page?.folderId ?? null, recentPageIds: useUi.getState().recentPageIds };
}

/**
 * The unlinked text just before the caret, back to the start of its line or
 * the last link, chip or line break; null when there's a selection.
 */
function textBeforeCaret(state: EditorState): { text: string; start: number } | null {
  const { selection } = state;
  if (!selection.empty || !selection.$from.parent.isTextblock) return null;
  const $caret = selection.$from;
  const lineStart = $caret.start();
  let text = '';
  let start = lineStart;
  $caret.parent.forEach((child, offset) => {
    if (offset >= $caret.parentOffset) return;
    const end = Math.min(child.nodeSize, $caret.parentOffset - offset);
    if (child.isText && !child.marks.some((m) => m.type.name === PAGE_LINK)) {
      text += child.text!.slice(0, end);
    } else {
      text = '';
      start = lineStart + offset + child.nodeSize;
    }
  });
  return { text, start };
}

/** The completion for the words just typed, unless the caret is mid-word. */
function ghostFor(state: EditorState, pageId: Id): Ghost | null {
  const before = textBeforeCaret(state);
  if (!before?.text) return null;
  const caret = state.selection.from;
  const next = state.doc.textBetween(caret, Math.min(caret + 1, state.selection.$from.end()));
  if (WORD_CHAR.test(next)) return null;
  const completion = completionAt(before.text, searchablePages(useNotebook.getState().pages), searchContext(pageId));
  return completion && { from: before.start + completion.from, to: caret, rest: completion.rest, pageId: completion.pageId };
}

/** The picker's search text. */
export function pickerQuery(state: EditorState, picker: Picker): string {
  switch (picker.mode) {
    case 'brackets':
      return state.doc.textBetween(picker.from + 2, state.selection.from);
    case 'words':
      return state.doc.textBetween(picker.from, state.selection.from);
    case 'selection':
      return state.doc.textBetween(picker.from, picker.to);
  }
}

/** The picker's rows: the best-fitting pages, then a row to create a page named by the search (unless one already is). */
export function pickerItems(state: EditorState, pageId: Id): PickerItem[] {
  const picker = autocompleteState(state)?.picker;
  if (!picker) return [];
  const query = pickerQuery(state, picker).trim().replace(/\s+/g, ' ');
  const pages = useNotebook.getState().pages;
  const items: PickerItem[] = searchPages(query, searchablePages(pages), searchContext(pageId)).map((result) => ({ kind: 'page', result }));
  const taken = (name: string) => name.trim().toLowerCase() === query.toLowerCase();
  if (query && !pages.some((p) => taken(p.title) || (p.aliases ?? []).some(taken))) items.push({ kind: 'create', title: query });
  return items;
}

/**
 * The open picker after a transaction, or null once it no longer applies:
 * the caret left the search (or the line), the [[ was deleted, or the
 * search grew too long. Typing over a selection turns it into a word search.
 */
function followPicker(picker: Picker, tr: Transaction, state: EditorState): Picker | null {
  const { selection } = state;
  let next: Picker = { ...picker, from: tr.mapping.map(picker.from, -1), to: tr.mapping.map(picker.to), selected: tr.docChanged ? 0 : picker.selected };
  if (picker.mode === 'selection') {
    if (!tr.docChanged) return selection.from === next.from && selection.to === next.to ? next : null;
    next = { ...next, mode: 'words' };
  }
  if (!selection.empty) return null;
  const caret = selection.from;
  const searchStart = next.from + (next.mode === 'brackets' ? 2 : 0);
  if (caret < searchStart || next.from > state.doc.content.size || !state.doc.resolve(next.from).sameParent(selection.$from)) return null;
  if (next.mode === 'brackets' && state.doc.textBetween(next.from, next.from + 2) !== '[[') return null;
  const query = state.doc.textBetween(searchStart, caret);
  if (query.length > MAX_QUERY || query.includes(']]')) return null;
  return next;
}

/** A picker for [[ just typed (not a third [ in a row). */
function bracketPicker(state: EditorState): Picker | null {
  const before = textBeforeCaret(state)?.text ?? '';
  if (!before.endsWith('[[') || before.endsWith('[[[')) return null;
  const from = state.selection.from - 2;
  return { mode: 'brackets', from, to: from, selected: 0 };
}

/** Links [from, to) to a page, puts the caret after it and closes the autocomplete. */
function link(tr: Transaction, from: number, to: number, pageId: Id): Transaction {
  const mark = tr.doc.type.schema.marks[PAGE_LINK].create({ pageId });
  return tr
    .addMark(from, to, mark)
    .setSelection(TextSelection.create(tr.doc, to))
    .setMeta(pluginKey, { type: 'close' } satisfies Action);
}

/** Tab: finishes the word with the grey completion and links the mention. */
export function acceptGhost(view: EditorView) {
  const ghost = autocompleteState(view.state)?.ghost;
  if (!ghost) return;
  const tr = view.state.tr.insertText(ghost.rest, ghost.to);
  view.dispatch(link(tr, ghost.from, ghost.to + ghost.rest.length, ghost.pageId));
  view.focus();
}

/** Picks a row: links the search to that page (creating it first for the create row). */
export function acceptItem(view: EditorView, pageId: Id, item: PickerItem) {
  const picker = autocompleteState(view.state)?.picker;
  if (!picker) return;
  const query = pickerQuery(view.state, picker);
  let target: Id;
  let name: string;
  if (item.kind === 'create') {
    const folderId = useNotebook.getState().pages.find((p) => p.id === pageId)?.folderId ?? null;
    target = useNotebook.getState().addPage(folderId, item.title);
    name = item.title;
  } else {
    target = item.result.pageId;
    name = item.result.name;
  }

  const caret = view.state.selection.from;
  const tr = view.state.tr;
  let end: number;
  if (picker.mode === 'selection') {
    end = picker.to;
  } else if (picker.mode === 'brackets') {
    tr.insertText(name, picker.from, caret);
    end = picker.from + name.length;
  } else {
    // Keep the writer's words when they start the name; otherwise (typos) put the name in their place.
    const rest = item.kind === 'create' ? '' : restOfWordIn(query, name);
    if (rest === null) {
      tr.insertText(name, picker.from, caret);
      end = picker.from + name.length;
    } else {
      if (rest) tr.insertText(rest, caret);
      end = caret + rest.length;
    }
  }
  view.dispatch(link(tr, picker.from, end, target));
  view.focus();
}

/** Highlights a row of the picker. */
export function selectItem(view: EditorView, index: number) {
  view.dispatch(view.state.tr.setMeta(pluginKey, { type: 'select', index } satisfies Action));
}

/** Closes the picker and hides the completion. */
export function closeAutocomplete(view: EditorView) {
  const s = autocompleteState(view.state);
  if (s?.picker || s?.ghost) view.dispatch(view.state.tr.setMeta(pluginKey, { type: 'close' } satisfies Action));
}

/** Ctrl+Space: opens the picker on the selection, or on the words being typed. */
function openPicker(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  let picker: Picker;
  if (!selection.empty) {
    if (!selection.$from.sameParent(selection.$to)) return false;
    picker = { mode: 'selection', from: selection.from, to: selection.to, selected: 0 };
  } else {
    const before = textBeforeCaret(state);
    if (!before) return false;
    const ghost = autocompleteState(state)?.ghost;
    const word = /[\p{L}\p{N}'’]*$/u.exec(before.text)![0];
    const from = ghost?.from ?? selection.from - word.length;
    picker = { mode: 'words', from, to: from, selected: 0 };
  }
  view.dispatch(state.tr.setMeta(pluginKey, { type: 'open', picker } satisfies Action));
  return true;
}

/** The grey completion after the caret; clicking (tapping) it accepts it. */
function ghostWidget(rest: string) {
  return (view: EditorView) => {
    const span = document.createElement('span');
    span.className = 'link-ghost';
    span.textContent = rest;
    span.title = 'Tab to finish and link';
    span.contentEditable = 'false';
    span.addEventListener('mousedown', (e) => e.preventDefault());
    span.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      acceptGhost(view);
    });
    return span;
  };
}

/** Options for LinkAutocomplete. */
interface Options {
  /** The page this editor belongs to (never offered). */
  pageId: Id;
}

export const LinkAutocomplete = Extension.create<Options>({
  name: 'linkAutocomplete',
  // Ahead of the list keymap, so Tab finishes a word instead of indenting while a completion shows.
  priority: 200,

  addOptions() {
    return { pageId: '' };
  },

  addProseMirrorPlugins() {
    const pageId = this.options.pageId;
    return [
      new Plugin<AutocompleteState>({
        key: pluginKey,
        state: {
          init: () => ({ ghost: null, picker: null, dismissedFrom: null }),
          apply(tr, prev, oldState, state) {
            const action = tr.getMeta(pluginKey) as Action | undefined;
            const dismissedFrom = prev.dismissedFrom === null ? null : tr.mapping.map(prev.dismissedFrom);
            switch (action?.type) {
              case 'close':
                return { ghost: null, picker: null, dismissedFrom };
              case 'dismissGhost':
                return { ghost: null, picker: prev.picker, dismissedFrom: prev.ghost?.from ?? dismissedFrom };
              case 'open':
                return { ghost: null, picker: action.picker, dismissedFrom };
              case 'select':
                return prev.picker ? { ...prev, picker: { ...prev.picker, selected: action.index } } : prev;
            }

            // Only typing (the text grew) offers anything new; deleting or moving the caret just takes it away.
            const typed = tr.docChanged && state.doc.content.size > oldState.doc.content.size;
            const picker = (prev.picker && followPicker(prev.picker, tr, state)) ?? (typed ? bracketPicker(state) : null);
            let ghost: Ghost | null = null;
            if (!picker && typed) {
              ghost = ghostFor(state, pageId);
              if (ghost && ghost.from === dismissedFrom) ghost = null;
            } else if (!picker && !tr.docChanged && tr.selection.eq(oldState.selection)) {
              ghost = prev.ghost;
            }
            return { ghost, picker, dismissedFrom };
          },
        },
        props: {
          decorations(state) {
            const s = pluginKey.getState(state);
            const decorations: Decoration[] = [];
            // On a phone the completion shows above the text instead (LinkPicker): a widget in the word being
            // composed would upset the keyboard.
            if (s?.ghost && !isPhoneLayout()) {
              decorations.push(
                Decoration.widget(s.ghost.to, ghostWidget(s.ghost.rest), { side: 1, marks: [], ignoreSelection: true, key: `ghost:${s.ghost.rest}` }),
              );
            }
            if (s?.picker) {
              const end = s.picker.mode === 'selection' ? s.picker.to : state.selection.from;
              if (end > s.picker.from) decorations.push(Decoration.inline(s.picker.from, end, { class: 'link-picker-query' }));
            }
            return decorations.length ? DecorationSet.create(state.doc, decorations) : null;
          },

          handleKeyDown(view, event) {
            const s = pluginKey.getState(view.state);
            if (!s) return false;
            const plain = !event.ctrlKey && !event.metaKey && !event.altKey;

            if (s.picker) {
              const items = pickerItems(view.state, pageId);
              const count = items.length;
              switch (event.key) {
                case 'ArrowDown':
                case 'ArrowUp':
                  if (count) selectItem(view, (s.picker.selected + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
                  return true;
                case 'Enter':
                case 'Tab':
                  if (count) acceptItem(view, pageId, items[Math.min(s.picker.selected, count - 1)]);
                  else closeAutocomplete(view);
                  return true;
                case 'Escape':
                  // Not the peek panel's Escape too.
                  event.stopPropagation();
                  closeAutocomplete(view);
                  return true;
              }
              return false;
            }

            if (event.ctrlKey && (event.key === ' ' || event.code === 'Space')) return openPicker(view);
            if (s.ghost && event.key === 'Tab' && plain && !event.shiftKey) {
              acceptGhost(view);
              return true;
            }
            if (s.ghost && event.key === 'Escape') {
              event.stopPropagation();
              view.dispatch(view.state.tr.setMeta(pluginKey, { type: 'dismissGhost' } satisfies Action));
              return true;
            }
            return false;
          },

          handleDOMEvents: {
            blur(view) {
              closeAutocomplete(view);
              return false;
            },
          },
        },
      }),
    ];
  },
});
