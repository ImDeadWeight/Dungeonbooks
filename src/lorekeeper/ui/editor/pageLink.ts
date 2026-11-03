/**
 * @file The page-link mark: text linked to another page by id, so links
 * survive the target page being renamed. Rendered as <a data-page-id>.
 */
import { getMarkRange, Mark, mergeAttributes } from '@tiptap/core';
import type { EditorView } from '@tiptap/pm/view';
import type { Id } from '../../domain/ids';

/** Mark name, also used by the link-suggestion plugin to skip already-linked text. */
export const PAGE_LINK = 'pageLink';

export const PageLink = Mark.create({
  name: PAGE_LINK,
  // Typing right after a link doesn't extend it.
  inclusive: false,

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-page-id'),
        renderHTML: (attrs) => ({ 'data-page-id': attrs.pageId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-page-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(HTMLAttributes, { class: 'page-link' }), 0];
  },
});

/** The page a clicked element links to, if it is (inside) a page link. */
export function linkedPageId(target: EventTarget | null): Id | null {
  const el = target instanceof Element ? target.closest('a[data-page-id]') : null;
  return el?.getAttribute('data-page-id') ?? null;
}

/**
 * Returns a function that removes the link at `pos`, as long as that spot
 * still links to the same page when it is called.
 */
export function unlinkAt(view: EditorView, pos: number, pageId: Id): () => void {
  return () => {
    const type = view.state.schema.marks[PAGE_LINK];
    if (pos > view.state.doc.content.size) return;
    const range = getMarkRange(view.state.doc.resolve(pos), type, { pageId });
    if (range) view.dispatch(view.state.tr.removeMark(range.from, range.to, type));
  };
}
