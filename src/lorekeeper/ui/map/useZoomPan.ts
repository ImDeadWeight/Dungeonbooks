/**
 * @file Zooming and panning one image in a frame: the wheel zooms about the
 * pointer, dragging pans, two fingers pinch. A press that barely moves is a
 * tap, reported with the spot as fractions of the image.
 */
import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';

/** Image pixels → frame pixels: frame = image * scale + offset. */
export interface View {
  scale: number;
  x: number;
  y: number;
}

/** A press moving less than this (px) is a tap. */
const TAP_SLOP = 5;
const MIN_SCALE = 0.05;
const MAX_SCALE = 8;

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** Zooms by `factor` keeping the frame point (fx, fy) still. */
function zoomAt(v: View, factor: number, fx: number, fy: number): View {
  const scale = clampScale(v.scale * factor);
  const k = scale / v.scale;
  return { scale, x: fx - (fx - v.x) * k, y: fy - (fy - v.y) * k };
}

export function useZoomPan(onTap: (fx: number, fy: number) => void) {
  const frame = useRef<HTMLDivElement>(null);
  const size = useRef({ width: 1, height: 1 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: View; startX: number; startY: number; moved: boolean; pinch?: { dist: number; midX: number; midY: number } } | null>(null);

  const local = (clientX: number, clientY: number) => {
    const r = frame.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  /** Shows the whole image, centred. */
  const fit = useCallback(() => {
    const r = frame.current?.getBoundingClientRect();
    if (!r) return;
    const { width, height } = size.current;
    const scale = clampScale(Math.min(r.width / width, r.height / height));
    setView({ scale, x: (r.width - width * scale) / 2, y: (r.height - height * scale) / 2 });
  }, []);

  /** Call once the image has loaded, with its natural size. */
  const setImageSize = useCallback(
    (width: number, height: number) => {
      size.current = { width, height };
      fit();
    },
    [fit],
  );

  const zoomBy = (factor: number) => {
    const r = frame.current!.getBoundingClientRect();
    setView((v) => zoomAt(v, factor, r.width / 2, r.height / 2));
  };

  const onWheel = (e: WheelEvent) => {
    const p = local(e.clientX, e.clientY);
    setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.0015), p.x, p.y));
  };

  const pinchOf = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    frame.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e.clientX, e.clientY));
    const p = local(e.clientX, e.clientY);
    gesture.current = { start: view, startX: p.x, startY: p.y, moved: pointers.current.size > 1, pinch: pointers.current.size === 2 ? pinchOf() : undefined };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e.clientX, e.clientY));
    if (g.pinch && pointers.current.size === 2) {
      const now = pinchOf();
      const zoomed = zoomAt(g.start, now.dist / g.pinch.dist, g.pinch.midX, g.pinch.midY);
      setView({ ...zoomed, x: zoomed.x + now.midX - g.pinch.midX, y: zoomed.y + now.midY - g.pinch.midY });
      return;
    }
    const p = local(e.clientX, e.clientY);
    const dx = p.x - g.startX;
    const dy = p.y - g.startY;
    if (Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;
    if (g.moved) setView({ ...g.start, x: g.start.x + dx, y: g.start.y + dy });
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      // One finger of a pinch lifted: carry on panning with the other from here.
      const [rest] = [...pointers.current.values()];
      gesture.current = { start: view, startX: rest.x, startY: rest.y, moved: true };
      return;
    }
    gesture.current = null;
    if (g && !g.moved) {
      const p = local(e.clientX, e.clientY);
      onTap((p.x - view.x) / (size.current.width * view.scale), (p.y - view.y) / (size.current.height * view.scale));
    }
  };

  /** Where a spot on the image (fractions) is in the frame (px). */
  const toFrame = (fx: number, fy: number) => ({ x: view.x + fx * size.current.width * view.scale, y: view.y + fy * size.current.height * view.scale });
  /** The image fraction at a frame point. */
  const toImage = (x: number, y: number) => ({ x: (x - view.x) / (size.current.width * view.scale), y: (y - view.y) / (size.current.height * view.scale) });

  return {
    frame,
    view,
    fit,
    zoomBy,
    setImageSize,
    toFrame,
    toImage,
    local,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
