/**
 * @file One image on the page canvas: drag it by its bar, resize it from its
 * right edge, give it a caption, and open it as a map (its pins show on it
 * here too; tap one to peek at its page).
 */
import { GripHorizontal, Map as MapIcon, MapPin as PinIcon, Trash2 } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Id } from '../../domain/ids';
import type { ImageBox } from '../../domain/notebook';
import { isPhoneLayout } from '../../../platform';
import { deleteImage, updateImage } from '../../state/imageActions';
import { useImageUrl } from '../../state/imageFiles';
import { useUi } from '../../state/uiStore';
import { openMap } from '../map/mapStore';
import { showPage } from './showPage';
import { trackPointer } from './trackPointer';
import './imageBox.css';

/** Narrowest an image can be resized to (px). */
const MIN_WIDTH = 120;

export function ImageBoxView({ pageId, image }: { pageId: Id; image: ImageBox }) {
  const url = useImageUrl(image.imageId);
  const update = (patch: Parameters<typeof updateImage>[2]) => updateImage(pageId, image.id, patch);
  const map = () => openMap({ pageId, boxId: image.id });

  const startMove = (e: ReactPointerEvent) => {
    if (isPhoneLayout()) return;
    const { x, y } = image;
    trackPointer(e, (dx, dy) => update({ x: Math.max(0, x + dx), y: Math.max(0, y + dy) }));
  };
  const startResize = (e: ReactPointerEvent) => {
    if (isPhoneLayout()) return;
    const { width } = image;
    trackPointer(e, (dx) => update({ width: Math.max(MIN_WIDTH, width + dx) }));
  };

  return (
    <div className="text-box image-box" style={{ left: image.x, top: image.y, width: image.width }}>
      <div className="text-box-grip" onPointerDown={startMove} title="Drag to move">
        <GripHorizontal size={14} />
        <span className="spacer" />
        <button className="icon" title="Open as a map (pin pages on it)" onPointerDown={(e) => e.stopPropagation()} onClick={map}>
          <MapIcon size={13} />
        </button>
        <button
          className="icon"
          title="Delete image"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() =>
            useUi.getState().askConfirm({ message: 'Delete this image (and any pins on it)?', confirmLabel: 'Delete image', onConfirm: () => deleteImage(pageId, image.id) })
          }
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="image-frame" onDoubleClick={map}>
        {url && <img src={url} alt={image.caption ?? ''} draggable={false} />}
        {url === undefined && <div className="image-loading" />}
        {url === null && <p className="muted image-missing">The image file is missing.</p>}
        {(image.pins ?? []).map((pin) => (
          <button
            key={pin.id}
            className="image-pin"
            style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
            title="Click to peek, Ctrl+click to open"
            onClick={(e) => showPage(e, pin.pageId)}
          >
            <PinIcon size={16} />
          </button>
        ))}
      </div>
      <input className="image-caption" placeholder="Caption" value={image.caption ?? ''} onChange={(e) => update({ caption: e.target.value })} />
      <div className="text-box-resize" onPointerDown={startResize} title="Drag to resize" />
    </div>
  );
}
