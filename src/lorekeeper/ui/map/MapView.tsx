/**
 * @file An image as a map, over the page: zoom and pan it, tap an empty spot
 * to pin a page there, tap a pin for its page (or that page's own map), drag
 * a pin to move it. Escape or × goes back to the page.
 */
import { MapPin as PinIcon, Maximize, Minus, Plus, X } from 'lucide-react';
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { clampFraction } from '../../domain/images';
import type { ImageBox, MapPin } from '../../domain/notebook';
import { addPin, movePin } from '../../state/imageActions';
import { useImageUrl } from '../../state/imageFiles';
import { useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';
import { trackPointer } from '../page/trackPointer';
import { closeMap, useMapView, type OpenMap } from './mapStore';
import { PinMenu } from './PinMenu';
import { PinPicker } from './PinPicker';
import { useZoomPan } from './useZoomPan';
import './map.css';

/** A spot in the frame (px), with what happens there. */
type Popup = { kind: 'new'; fx: number; fy: number; x: number; y: number } | { kind: 'pin'; pin: MapPin; x: number; y: number };

function Pins({ map, image, zoom, onTap }: { map: OpenMap; image: ImageBox; zoom: ReturnType<typeof useZoomPan>; onTap(pin: MapPin, x: number, y: number): void }) {
  const pages = useNotebook((s) => s.pages);
  const titles = new Map(pages.map((p) => [p.id, p.title]));
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);

  const start = (e: ReactPointerEvent, pin: MapPin) => {
    e.stopPropagation();
    const from = zoom.toFrame(pin.x, pin.y);
    trackPointer(
      e,
      (dx, dy) => Math.hypot(dx, dy) > 4 && setDragging({ id: pin.id, x: from.x + dx, y: from.y + dy }),
      (dx, dy) => {
        setDragging(null);
        if (Math.hypot(dx, dy) <= 4) return onTap(pin, from.x, from.y);
        const to = zoom.toImage(from.x + dx, from.y + dy);
        movePin(map.pageId, map.boxId, pin.id, clampFraction(to.x), clampFraction(to.y));
      },
    );
  };

  return (
    <>
      {(image.pins ?? []).map((pin) => {
        const at = dragging?.id === pin.id ? dragging : zoom.toFrame(pin.x, pin.y);
        const title = titles.get(pin.pageId);
        return (
          <button key={pin.id} className={`map-pin${title ? '' : ' broken'}`} style={{ left: at.x, top: at.y }} onPointerDown={(e) => start(e, pin)} title={title ?? 'Deleted page'}>
            <PinIcon size={22} />
            <span className="map-pin-label">{title ?? 'Deleted page'}</span>
          </button>
        );
      })}
    </>
  );
}

function MapFrame({ map, image }: { map: OpenMap; image: ImageBox }) {
  const url = useImageUrl(image.imageId);
  const [popup, setPopup] = useState<Popup | null>(null);
  const zoom = useZoomPan((fx, fy) => {
    if (popup) return setPopup(null);
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    const at = zoom.toFrame(fx, fy);
    setPopup({ kind: 'new', fx, fy, x: at.x, y: at.y });
  });

  return (
    <div className="map-frame" ref={zoom.frame} {...zoom.handlers}>
      {url && (
        <img
          src={url}
          alt={image.caption ?? 'Map'}
          draggable={false}
          onLoad={(e) => zoom.setImageSize(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
          style={{ transform: `translate(${zoom.view.x}px, ${zoom.view.y}px) scale(${zoom.view.scale})` }}
        />
      )}
      {url === null && <p className="empty-state">The image file is missing.</p>}
      <Pins map={map} image={image} zoom={zoom} onTap={(pin, x, y) => setPopup({ kind: 'pin', pin, x, y })} />
      <div className="map-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button className="icon" title="Zoom in" onClick={() => zoom.zoomBy(1.4)}>
          <Plus size={16} />
        </button>
        <button className="icon" title="Zoom out" onClick={() => zoom.zoomBy(1 / 1.4)}>
          <Minus size={16} />
        </button>
        <button className="icon" title="Show it all" onClick={zoom.fit}>
          <Maximize size={16} />
        </button>
      </div>
      {popup?.kind === 'new' && (
        <PinPicker
          pageId={map.pageId}
          x={popup.x}
          y={popup.y}
          cancel={() => setPopup(null)}
          choose={(pageId) => {
            addPin(map.pageId, map.boxId, { x: popup.fx, y: popup.fy, pageId });
            setPopup(null);
          }}
        />
      )}
      {popup?.kind === 'pin' && <PinMenu map={map} pin={popup.pin} x={popup.x} y={popup.y} close={() => setPopup(null)} />}
    </div>
  );
}

/** The open map, if any. */
export function MapView() {
  const map = useMapView((s) => s.open);
  const page = useNotebook((s) => s.pages.find((p) => p.id === map?.pageId));
  const image = page?.images?.find((i) => i.id === map?.boxId);

  useEffect(() => {
    if (!map) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !(e.target instanceof HTMLInputElement) && closeMap();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map]);

  // The image (or its page) was deleted, or another campaign opened.
  useEffect(() => {
    if (map && !image) closeMap();
  }, [map, image]);

  // Going to another page leaves the map.
  const selectedPageId = useUi((s) => s.selectedPageId);
  useEffect(() => closeMap(), [selectedPageId]);

  if (!map || !page || !image) return null;
  return (
    <div className="map-view">
      <div className="map-header">
        <h3>{image.caption || `${page.title}: map`}</h3>
        <span className="muted map-hint">Tap a spot to pin a page there. Drag pins to move them.</span>
        <span className="spacer" />
        <button className="icon" title="Back to the page" onClick={closeMap}>
          <X size={18} />
        </button>
      </div>
      <MapFrame key={image.id} map={map} image={image} />
    </div>
  );
}
