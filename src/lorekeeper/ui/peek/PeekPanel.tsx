/**
 * @file The peek panel: a small floating view of a linked page, opened by
 * clicking a link. Links inside it open their page in the same panel.
 */
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ExternalLink, Unlink, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { TextBox } from '../../domain/notebook';
import { useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';
import { EncounterLink } from '../editor/encounterLink';
import { linkedPageId, PageLink } from '../editor/pageLink';
import './peek.css';

/** Panel size (px); keep in step with peek.css. */
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 320;
/** Gap between the clicked link and the panel (px). */
const OFFSET = 14;

/** One text box's content, read-only. */
function ReadOnlyBox({ box }: { box: TextBox }) {
  const editor = useEditor({ extensions: [StarterKit, PageLink, EncounterLink], content: box.content, editable: false }, [box.content]);
  return <EditorContent editor={editor} className="peek-box" />;
}

/** Puts the panel just below-right of the link, flipped/clamped to stay on screen. */
function placement(x: number, y: number) {
  const left = Math.min(x + OFFSET, window.innerWidth - PANEL_WIDTH - 8);
  const below = y + OFFSET;
  const top = below + PANEL_HEIGHT < window.innerHeight ? below : Math.max(8, y - OFFSET - PANEL_HEIGHT);
  return { left: Math.max(8, left), top };
}

/** Shows the page the open peek points at; closes on Escape or a click outside. */
export function PeekPanel() {
  const peek = useUi((s) => s.peek);
  const page = useNotebook((s) => s.pages.find((p) => p.id === peek?.pageId));
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!peek) return;
    const close = () => useUi.getState().closePeek();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node)) close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [peek]);

  if (!peek) return null;
  const ui = useUi.getState();
  // Reading order: top to bottom, then left to right.
  const boxes = page ? [...page.boxes].sort((a, b) => a.y - b.y || a.x - b.x) : [];

  return (
    <div
      ref={panel}
      className="peek-panel"
      style={placement(peek.x, peek.y)}
      onClick={(e) => {
        const target = linkedPageId(e.target);
        if (target) ui.openPeek({ ...peek, pageId: target, unlink: undefined });
      }}
    >
      <div className="peek-header">
        <h3 className="peek-title">{page?.title ?? 'Missing page'}</h3>
        {page && (
          <button className="icon" title="Open this page" onClick={() => ui.selectPage(page.id)}>
            <ExternalLink size={15} />
          </button>
        )}
        {peek.unlink && (
          <button
            className="icon"
            title="Remove this link (the text stays)"
            onClick={() => {
              peek.unlink?.();
              ui.closePeek();
            }}
          >
            <Unlink size={15} />
          </button>
        )}
        <button className="icon" title="Close" onClick={ui.closePeek}>
          <X size={15} />
        </button>
      </div>
      <div className="peek-body">
        {!page && <p className="muted">The page this link pointed to has been deleted.</p>}
        {page && boxes.length === 0 && <p className="muted">This page is empty.</p>}
        {boxes.map((box) => (
          <ReadOnlyBox key={box.id} box={box} />
        ))}
      </div>
    </div>
  );
}
