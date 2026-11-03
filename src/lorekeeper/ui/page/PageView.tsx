/**
 * @file The open page: its title, type and (for characters) the encounters
 * they're in and the stat block panel, and a canvas where clicking any empty
 * spot starts a new text box there (OneNote style).
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { Page } from '../../domain/notebook';
import { NEW_PAGE_TITLE, useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';
import { CharacterEncounters } from '../encounters/CharacterEncounters';
import { usePhoneLayout } from '../common/usePhoneLayout';
import { PageInfoBar } from './PageInfoBar';
import { StatBlockPanel } from './StatBlockPanel';
import { TextBoxView } from './TextBoxView';
import './page.css';

/** Room left past the right-most / lowest box so there is always space to click (px). */
const CANVAS_MARGIN = 600;
/** Where a box made on a phone is saved (after the last box), so the desktop shows it in a sensible spot. */
const PHONE_NEW_BOX_X = 40;
const PHONE_NEW_BOX_GAP = 140;

/** The page's title field: renames live, and falls back to "Untitled page" if left blank. */
function PageTitle({ page }: { page: Page }) {
  const [value, setValue] = useState(page.title);
  const input = useRef<HTMLInputElement>(null);
  const focusTitlePageId = useUi((s) => s.focusTitlePageId);

  // Follow renames made elsewhere (the sidebar).
  useEffect(() => setValue(page.title), [page.title]);

  // A page just created starts with its title selected, ready to type over.
  useEffect(() => {
    if (focusTitlePageId === page.id) {
      input.current?.select();
      useUi.getState().setFocusTitle(null);
    }
  }, [focusTitlePageId, page.id]);

  const change = (text: string) => {
    setValue(text);
    if (text.trim()) useNotebook.getState().renamePage(page.id, text.trim());
  };

  return (
    <input
      ref={input}
      className="page-title"
      value={value}
      placeholder={NEW_PAGE_TITLE}
      onChange={(e) => change(e.target.value)}
      onBlur={() => !value.trim() && setValue(page.title)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

/** The selected page, or a hint when none is open. */
export function PageView() {
  const selectedPageId = useUi((s) => s.selectedPageId);
  const page = useNotebook((s) => s.pages.find((p) => p.id === selectedPageId));
  // Phones show the boxes as one column in reading order; their saved positions are left alone.
  const phone = usePhoneLayout();
  const statBlockOpen = useUi((s) => s.statBlockOpen);

  if (!page) {
    return (
      <main className="main-panel page-view">
        <p className="empty-state">Select a page in the sidebar, or create one with the + buttons there.</p>
      </main>
    );
  }

  const width = Math.max(0, ...page.boxes.map((b) => b.x + b.width)) + CANVAS_MARGIN;
  const height = Math.max(0, ...page.boxes.map((b) => b.y)) + CANVAS_MARGIN;

  // Clicking empty canvas starts a new box at that spot (on a phone: after the last box).
  const addBoxAt = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.button !== 0) return;
    // Keep focus where it is until the new box takes it (an empty box being left is then discarded).
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const [x, y] = phone
      ? [PHONE_NEW_BOX_X, page.boxes.length ? Math.max(...page.boxes.map((b) => b.y)) + PHONE_NEW_BOX_GAP : PHONE_NEW_BOX_X]
      : [Math.round(e.clientX - rect.left), Math.round(e.clientY - rect.top) - 12];
    const id = useNotebook.getState().addBox(page.id, x, y);
    useUi.getState().setFocusBox(id);
  };

  // Reading order on a phone: top to bottom, then left to right.
  const boxes = phone ? [...page.boxes].sort((a, b) => a.y - b.y || a.x - b.x) : page.boxes;

  return (
    <main className="main-panel page-view">
      <div className="page-header">
        <PageTitle key={page.id} page={page} />
        <PageInfoBar page={page} />
        {page.info?.type === 'character' && <CharacterEncounters page={page} />}
      </div>
      <div className="page-body">
        <div className="page-scroll">
          <div
            className={`page-canvas${phone ? ' flow' : ''}`}
            style={phone ? undefined : { minWidth: width, minHeight: height }}
            onMouseDown={addBoxAt}
          >
            {page.boxes.length === 0 && <p className="canvas-hint">{phone ? 'Tap here to start writing.' : 'Click anywhere to start writing.'}</p>}
            {boxes.map((box) => (
              <TextBoxView key={box.id} pageId={page.id} box={box} />
            ))}
          </div>
        </div>
        {statBlockOpen && page.info?.type === 'character' && <StatBlockPanel key={page.id} page={page} />}
      </div>
    </main>
  );
}
