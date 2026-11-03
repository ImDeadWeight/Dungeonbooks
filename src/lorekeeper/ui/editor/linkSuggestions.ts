/**
 * @file Link suggestions: while editing, any unlinked mention of another
 * page's title gets a dotted underline and a small link button after it;
 * clicking the button links the text to that page. Links to deleted pages
 * are marked as broken.
 */
import { Extension } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { Id } from '../../domain/ids';
import { createTitleMatcher, normalizeTitle, type TitleMatcher } from '../../domain/titleMatcher';
import { useNotebook } from '../../state/notebookStore';
import { PAGE_LINK } from './pageLink';

const pluginKey = new PluginKey<DecorationSet>('linkSuggestions');

/** lucide "link-2" icon, drawn inside each suggestion button. */
const LINK_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>';

/** Matcher for the last set of titles seen, shared by every box (rebuilt only when titles change). */
let cached: { key: string; matcher: TitleMatcher } | null = null;

/** A matcher for every page except the one being edited (a page never suggests linking to itself). */
function matcherFor(currentPageId: Id): TitleMatcher {
  const candidates = useNotebook
    .getState()
    .pages.filter((p) => p.id !== currentPageId)
    .map((p) => ({ pageId: p.id, title: p.title }));
  const key = candidates.map((c) => `${c.pageId}\u0000${c.title}`).join('\u0001');
  if (cached?.key !== key) cached = { key, matcher: createTitleMatcher(candidates) };
  return cached.matcher;
}

/** The button shown after a suggested mention. Links [end - length, end) when clicked. */
function suggestionButton(pageId: Id, title: string, matched: string) {
  return (view: EditorView, getPos: () => number | undefined) => {
    const button = document.createElement('button');
    button.className = 'link-suggestion-button';
    button.title = `Link to "${title}"`;
    button.contentEditable = 'false';
    button.innerHTML = LINK_ICON;
    // Keep the caret in the editor.
    button.addEventListener('mousedown', (e) => e.preventDefault());
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const end = getPos();
      if (end === undefined) return;
      const start = end - matched.length;
      // The text may have changed since this button was drawn.
      if (start < 0 || normalizeTitle(view.state.doc.textBetween(start, end)) !== normalizeTitle(matched)) return;
      const mark = view.state.schema.marks[PAGE_LINK].create({ pageId });
      view.dispatch(view.state.tr.addMark(start, end, mark));
      view.focus();
    });
    return button;
  };
}

/** Builds the underline + button decorations for every suggestion, and the broken-link styling. */
function buildDecorations(doc: PmNode, currentPageId: Id): DecorationSet {
  const pages = useNotebook.getState().pages;
  const titles = new Map(pages.map((p) => [p.id, p.title]));
  const matcher = matcherFor(currentPageId);
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // Collect runs of unlinked text; matches never cross a link or a line break.
    let run = '';
    let runStart = 0;
    const flush = () => {
      for (const m of matcher.find(run)) {
        const from = runStart + m.from;
        const to = runStart + m.to;
        const matched = run.slice(m.from, m.to);
        decorations.push(
          Decoration.inline(from, to, { class: 'link-suggestion' }),
          Decoration.widget(to, suggestionButton(m.pageId, titles.get(m.pageId) ?? '', matched), {
            side: 1,
            marks: [],
            ignoreSelection: true,
            key: `suggest:${m.pageId}:${matched}:${titles.get(m.pageId)}`,
          }),
        );
      }
      run = '';
    };
    node.forEach((child, offset) => {
      const childPos = pos + 1 + offset;
      const link = child.marks.find((mark) => mark.type.name === PAGE_LINK);
      if (child.isText && !link) {
        if (!run) runStart = childPos;
        run += child.text;
        return;
      }
      flush();
      if (link && !titles.has(link.attrs.pageId)) {
        decorations.push(Decoration.inline(childPos, childPos + child.nodeSize, { class: 'page-link-broken' }));
      }
    });
    flush();
    return false;
  });

  return DecorationSet.create(doc, decorations);
}

/** Options for LinkSuggestions. */
interface Options {
  /** The page this editor belongs to (never suggested). */
  pageId: Id;
}

export const LinkSuggestions = Extension.create<Options>({
  name: 'linkSuggestions',

  addOptions() {
    return { pageId: '' };
  },

  addProseMirrorPlugins() {
    const pageId = this.options.pageId;
    return [
      new Plugin<DecorationSet>({
        key: pluginKey,
        state: {
          init: (_, state) => buildDecorations(state.doc, pageId),
          apply: (tr, old, _oldState, newState) =>
            tr.docChanged || tr.getMeta(pluginKey) ? buildDecorations(newState.doc, pageId) : old,
        },
        props: {
          decorations: (state: EditorState) => pluginKey.getState(state),
        },
      }),
    ];
  },
});

/** Re-scans an editor's text, e.g. after pages were added, renamed or deleted. */
export function refreshLinkSuggestions(view: EditorView) {
  view.dispatch(view.state.tr.setMeta(pluginKey, true));
}
