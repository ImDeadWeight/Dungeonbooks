/**
 * @file The link picker's list under the caret (see linkAutocomplete.ts),
 * and on a phone the grey completion as a chip above the text to tap.
 * Follows the editor: redrawn on every transaction and when the page scrolls.
 */
import type { Editor } from '@tiptap/core';
import { Link2, Plus } from 'lucide-react';
import { useEffect, useReducer } from 'react';
import { createPortal } from 'react-dom';
import type { Id } from '../../domain/ids';
import { isPhoneLayout } from '../../../platform';
import { useNotebook } from '../../state/notebookStore';
import { PageTypeIcon } from '../page/pageTypes';
import { acceptGhost, acceptItem, autocompleteState, pickerItems, selectItem } from './linkAutocomplete';

/** Width of the list (px), and the room it needs below the caret before it opens above instead. */
const WIDTH = 300;
const ROOM_BELOW = 300;

/** Screen position for a popup next to document position `pos`: below it, or above when near the bottom. */
function placeAt(editor: Editor, pos: number): { left: number; top?: number; bottom?: number } {
  const at = editor.view.coordsAtPos(pos);
  const left = Math.max(8, Math.min(at.left, window.innerWidth - WIDTH - 8));
  return at.bottom + ROOM_BELOW > window.innerHeight ? { left, bottom: window.innerHeight - at.top + 4 } : { left, top: at.bottom + 4 };
}

/** The picker or phone completion chip for one text box's editor. */
export function LinkPicker({ editor, pageId }: { editor: Editor; pageId: Id }) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const titles = useNotebook((s) => s.pages);

  useEffect(() => {
    editor.on('transaction', redraw);
    window.addEventListener('scroll', redraw, true);
    window.addEventListener('resize', redraw);
    return () => {
      editor.off('transaction', redraw);
      window.removeEventListener('scroll', redraw, true);
      window.removeEventListener('resize', redraw);
    };
  }, [editor]);

  if (editor.isDestroyed) return null;
  const s = autocompleteState(editor.state);
  // Keep the caret in the editor when a row is clicked.
  const keepFocus = (e: { preventDefault(): void }) => e.preventDefault();

  if (s?.picker) {
    const items = pickerItems(editor.state, pageId);
    const selected = Math.min(s.picker.selected, items.length - 1);
    const titleOf = (id: Id) => titles.find((p) => p.id === id)?.title ?? '';
    return createPortal(
      <div className="link-picker" style={{ ...placeAt(editor, s.picker.from), width: WIDTH }} onMouseDown={keepFocus}>
        {items.length === 0 && <div className="link-picker-empty">Type a page name</div>}
        {items.map((item, i) => (
          <button
            key={item.kind === 'page' ? item.result.pageId : 'create'}
            className={`link-picker-row${i === selected ? ' selected' : ''}`}
            onMouseEnter={() => i !== selected && selectItem(editor.view, i)}
            onClick={() => acceptItem(editor.view, pageId, item)}
          >
            {item.kind === 'page' ? (
              <>
                <PageTypeIcon type={item.result.type} size={14} />
                <span className="link-picker-name">{item.result.name}</span>
                {item.result.viaAlias && <span className="link-picker-title">{titleOf(item.result.pageId)}</span>}
              </>
            ) : (
              <>
                <Plus size={14} />
                <span className="link-picker-name">Create page "{item.title}"</span>
              </>
            )}
          </button>
        ))}
        {!isPhoneLayout() && <div className="link-picker-hint">↑↓ choose · Enter link · Esc close</div>}
      </div>,
      document.body,
    );
  }

  if (s?.ghost && isPhoneLayout()) {
    const { ghost } = s;
    const word = editor.state.doc.textBetween(ghost.from, ghost.to) + ghost.rest;
    const at = editor.view.coordsAtPos(ghost.from);
    return createPortal(
      <button
        className="link-ghost-chip"
        style={{ left: Math.max(8, Math.min(at.left, window.innerWidth - 220)), bottom: window.innerHeight - at.top + 4 }}
        onMouseDown={keepFocus}
        onPointerDown={(e) => {
          e.preventDefault();
          acceptGhost(editor.view);
        }}
      >
        <Link2 size={14} />
        {word}
      </button>,
      document.body,
    );
  }

  return null;
}
