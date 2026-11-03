/**
 * @file The sidebar's resize handle: drag its right edge with a mouse or
 * trackpad (arrow keys when focused), double-click to reset. The width is
 * remembered on this device; touch-only and phone layouts don't show it.
 */
import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

/** Width before the user resizes it (px). */
const DEFAULT_WIDTH = 280;
/** Narrowest and widest the sidebar can be dragged (px). */
const MIN_WIDTH = 200;
const MAX_WIDTH = 600;
/** Never wider than this share of the window, so the rest keeps room. */
const MAX_SHARE = 0.5;
/** How far one arrow key press moves the edge (px). */
const KEY_STEP = 16;
/** Where the width is remembered (this device only). */
const STORAGE_KEY = 'lorekeeper:sidebar-width';

/** A width within the limits for the current window. */
const clamp = (width: number) =>
  Math.round(Math.max(MIN_WIDTH, Math.min(width, MAX_WIDTH, window.innerWidth * MAX_SHARE)));

/** The remembered width, or the default (storage may be unavailable). */
function savedWidth(): number {
  try {
    const width = Number(localStorage.getItem(STORAGE_KEY));
    return width > 0 ? clamp(width) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

/** Remembers the width; losing it only means the default next time. */
function saveWidth(width: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    // Storage unavailable: the width lasts until the app closes.
  }
}

/** The sidebar's width, and the style that applies it (through --sidebar-width, so phone styles can override it). */
export function useSidebarWidth() {
  const [width, setWidth] = useState(savedWidth);
  const style = { '--sidebar-width': `${width}px` } as CSSProperties;
  return { width, setWidth, style };
}

/** Props for SidebarResizer. */
interface Props {
  width: number;
  onChange(width: number): void;
}

/** The draggable right edge of the sidebar. */
export function SidebarResizer({ width, onChange }: Props) {
  // set(): applies a width within the limits and remembers it.
  const set = (next: number) => {
    const clamped = clamp(next);
    onChange(clamped);
    saveWidth(clamped);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    const startX = e.clientX;
    let latest = width;
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing-sidebar');
    const move = (ev: globalThis.PointerEvent) => {
      latest = clamp(width + ev.clientX - startX);
      onChange(latest);
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      document.body.classList.remove('resizing-sidebar');
      saveWidth(latest);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') set(width - KEY_STEP);
    else if (e.key === 'ArrowRight') set(width + KEY_STEP);
    else return;
    e.preventDefault();
  };

  return (
    <div
      className="sidebar-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      tabIndex={0}
      title="Drag to resize; double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={() => set(DEFAULT_WIDTH)}
      onKeyDown={onKeyDown}
    />
  );
}
