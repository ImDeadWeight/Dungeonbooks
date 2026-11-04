/**
 * @file A ⋯ button that opens a short menu of actions, so rows and bars keep
 * one small button instead of many easy-to-hit ones. The menu is drawn on the
 * page body (it can leave a scrolling sidebar), closes on a pick, a click
 * elsewhere, Escape or scrolling, and keeps the caret where it was.
 */
import { Check, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

/** One action in the menu. */
export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void | Promise<void>;
  /** Destructive: shown last-style in red, after a divider. */
  danger?: boolean;
  /** Shown for a moment in place of the label once done, before the menu closes ("Copied"). */
  doneLabel?: string;
}

/** Width of the menu (px). */
const WIDTH = 220;

/** The ⋯ button and its menu. */
export function MoreMenu({ items, title = 'More' }: { items: MenuItem[]; title?: string }) {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = () => {
    setAt(null);
    setDone(null);
  };

  useEffect(() => {
    if (!at) return;
    const outside = (e: Event) => !menu.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [at]);

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (at) return close();
    const r = e.currentTarget.getBoundingClientRect();
    // Under the button, right edges lined up, kept on screen.
    setAt({ left: Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8)), top: r.bottom + 4 });
  };

  const pick = async (item: MenuItem) => {
    await item.onSelect();
    if (!item.doneLabel) return close();
    setDone(item.label);
    setTimeout(close, 700);
  };

  const plain = items.filter((i) => !i.danger);
  const danger = items.filter((i) => i.danger);
  const row = (item: MenuItem) => (
    <button key={item.label} className={`more-menu-item${item.danger ? ' danger' : ''}`} onClick={() => void pick(item)}>
      {done === item.label ? <Check size={15} /> : <item.icon size={15} />}
      {done === item.label ? item.doneLabel : item.label}
    </button>
  );

  return (
    <>
      <button
        className={`icon more-menu-button${at ? ' open' : ''}`}
        title={title}
        aria-haspopup="menu"
        aria-expanded={!!at}
        // Don't start a drag (sidebar rows) or take the caret out of the text.
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
      >
        <MoreHorizontal size={16} />
      </button>
      {at &&
        createPortal(
          <div
            ref={menu}
            className="more-menu"
            role="menu"
            style={{ left: at.left, top: at.top, width: WIDTH }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            {plain.map(row)}
            {plain.length > 0 && danger.length > 0 && <div className="more-menu-divider" />}
            {danger.map(row)}
          </div>,
          document.body,
        )}
    </>
  );
}
