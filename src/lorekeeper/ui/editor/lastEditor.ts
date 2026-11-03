/**
 * @file The text box editor the user last typed in, so page-level actions
 * (like inserting an encounter link) can put things where the caret was.
 */
import type { Editor } from '@tiptap/core';
import type { Id } from '../../domain/ids';

let last: { pageId: Id; editor: Editor } | null = null;

/** Records the editor that just took focus. */
export function rememberEditor(pageId: Id, editor: Editor) {
  last = { pageId, editor };
}

/** Forgets an editor that is going away. */
export function forgetEditor(editor: Editor) {
  if (last?.editor === editor) last = null;
}

/** The last focused editor on a page, if it still exists. */
export function lastEditorOn(pageId: Id): Editor | null {
  return last && last.pageId === pageId && !last.editor.isDestroyed ? last.editor : null;
}
