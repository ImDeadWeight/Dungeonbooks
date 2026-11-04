/**
 * @file Following a drag: used for moving and resizing boxes on the canvas,
 * and for pins on maps.
 */
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Follows pointer moves until release, calling onMove with the distance from
 * the start, and onEnd (with the last distance) on release.
 */
export function trackPointer(e: ReactPointerEvent, onMove: (dx: number, dy: number) => void, onEnd?: (dx: number, dy: number) => void) {
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const move = (ev: PointerEvent) => onMove(ev.clientX - startX, ev.clientY - startY);
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    onEnd?.(ev.clientX - startX, ev.clientY - startY);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
