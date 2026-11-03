/**
 * @file One text box on the page canvas: a rich-text editor with a grip bar
 * to drag it, a handle to resize its width, and a delete button. Empty boxes
 * are discarded when they lose focus.
 */
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { GripHorizontal, Trash2 } from 'lucide-react';
import { useEffect, type PointerEvent as ReactPointerEvent } from 'react';
import type { Id } from '../../domain/ids';
import { isEmptyContent, type TextBox } from '../../domain/notebook';
import { isPhoneLayout } from '../../../platform';
import { useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';
import { EncounterLink } from '../editor/encounterLink';
import { forgetEditor, rememberEditor } from '../editor/lastEditor';
import { LinkSuggestions, refreshLinkSuggestions } from '../editor/linkSuggestions';
import { linkedPageId, PageLink, unlinkAt } from '../editor/pageLink';

/** Narrowest a box can be resized to (px). */
const MIN_WIDTH = 140;

/** Props for TextBoxView. */
interface Props {
  pageId: Id;
  box: TextBox;
}

/** Every page id + title, as one string; changes whenever a page is added, renamed or deleted. */
const selectTitlesKey = (s: ReturnType<typeof useNotebook.getState>) =>
  s.pages.map((p) => `${p.id}\u0000${p.title}`).join('\u0001');

/**
 * Follows pointer moves until release, calling onMove with the distance from
 * the start. Used for dragging and resizing.
 */
function trackPointer(e: ReactPointerEvent, onMove: (dx: number, dy: number) => void) {
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const move = (ev: PointerEvent) => onMove(ev.clientX - startX, ev.clientY - startY);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/** A movable, resizable rich-text box. */
export function TextBoxView({ pageId, box }: Props) {
  const titlesKey = useNotebook(selectTitlesKey);
  const focusBoxId = useUi((s) => s.focusBoxId);

  const editor = useEditor(
    {
      extensions: [StarterKit, PageLink, EncounterLink, LinkSuggestions.configure({ pageId })],
      content: box.content,
      onUpdate: ({ editor }) => useNotebook.getState().setBoxContent(pageId, box.id, editor.getJSON()),
      // Remembered so page actions (Link encounter) insert where the caret was.
      onFocus: ({ editor }) => rememberEditor(pageId, editor),
      onBlur: ({ editor }) => {
        if (isEmptyContent(editor.getJSON())) useNotebook.getState().deleteBox(pageId, box.id);
      },
      editorProps: {
        attributes: { class: 'box-editor' },
        // Click a link to peek at its page; Ctrl+click goes straight to it.
        handleClick(view, pos, event) {
          const target = linkedPageId(event.target);
          if (!target) return false;
          const ui = useUi.getState();
          if (event.ctrlKey || event.metaKey) ui.selectPage(target);
          else ui.openPeek({ pageId: target, x: event.clientX, y: event.clientY, unlink: unlinkAt(view, pos, target) });
          return true;
        },
      },
    },
    [pageId, box.id],
  );

  // An editor going away is no longer a place to insert into.
  useEffect(
    () => () => {
      if (editor) forgetEditor(editor);
    },
    [editor],
  );

  // Pages were added, renamed or deleted: re-check this box for mentions.
  useEffect(() => {
    if (editor && !editor.isDestroyed) refreshLinkSuggestions(editor.view);
  }, [editor, titlesKey]);

  // A box just created by clicking the canvas starts focused.
  useEffect(() => {
    if (editor && focusBoxId === box.id) {
      editor.commands.focus('end');
      useUi.getState().setFocusBox(null);
    }
  }, [editor, focusBoxId, box.id]);

  const update = (patch: Partial<TextBox>) => useNotebook.getState().updateBox(pageId, box.id, patch);
  const startMove = (e: ReactPointerEvent) => {
    // On a phone boxes sit in a column, so dragging would only scramble their desktop positions.
    if (isPhoneLayout()) return;
    const { x, y } = box;
    trackPointer(e, (dx, dy) => update({ x: Math.max(0, x + dx), y: Math.max(0, y + dy) }));
  };
  const startResize = (e: ReactPointerEvent) => {
    if (isPhoneLayout()) return;
    const { width } = box;
    trackPointer(e, (dx) => update({ width: Math.max(MIN_WIDTH, width + dx) }));
  };

  return (
    <div className="text-box" style={{ left: box.x, top: box.y, width: box.width }}>
      <div className="text-box-grip" onPointerDown={startMove} title="Drag to move">
        <GripHorizontal size={14} />
        <span className="spacer" />
        <button
          className="icon"
          title="Delete box"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() =>
            useUi.getState().askConfirm({
              message: 'Delete this text box and everything in it?',
              confirmLabel: 'Delete box',
              onConfirm: () => useNotebook.getState().deleteBox(pageId, box.id),
            })
          }
        >
          <Trash2 size={13} />
        </button>
      </div>
      <EditorContent editor={editor} />
      <div className="text-box-resize" onPointerDown={startResize} title="Drag to resize" />
    </div>
  );
}
