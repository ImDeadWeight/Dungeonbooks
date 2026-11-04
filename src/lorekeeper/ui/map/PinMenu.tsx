/**
 * @file What a tapped pin offers: peek at its page, open it, open that
 * page's own map (a city on a world map), or remove the pin.
 */
import { Eye, ExternalLink, Map as MapIcon, Trash2 } from 'lucide-react';
import type { Id } from '../../domain/ids';
import { mapsOf } from '../../domain/images';
import type { MapPin } from '../../domain/notebook';
import { removePin } from '../../state/imageActions';
import { useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';
import { closeMap, openMap, type OpenMap } from './mapStore';

interface Props {
  map: OpenMap;
  pin: MapPin;
  x: number;
  y: number;
  close(): void;
}

export function PinMenu({ map, pin, x, y, close }: Props) {
  const target = useNotebook((s) => s.pages.find((p) => p.id === pin.pageId));
  const ui = useUi.getState();
  const targetMap = target ? (mapsOf(target)[0] ?? target.images?.[0]) : undefined;
  const go = (pageId: Id) => {
    closeMap();
    ui.selectPage(pageId);
  };

  return (
    <div className="pin-menu" style={{ left: x, top: y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="pin-menu-title">{target?.title ?? 'Deleted page'}</div>
      {target && (
        <>
          <button
            onClick={(e) => {
              ui.openPeek({ pageId: target.id, x: e.clientX, y: e.clientY });
              close();
            }}
          >
            <Eye size={14} /> Peek
          </button>
          <button onClick={() => go(target.id)}>
            <ExternalLink size={14} /> Open page
          </button>
          {targetMap && target.id !== map.pageId && (
            <button
              onClick={() => {
                openMap({ pageId: target.id, boxId: targetMap.id });
                close();
              }}
            >
              <MapIcon size={14} /> Open its map
            </button>
          )}
        </>
      )}
      <button
        className="damage-text"
        onClick={() => {
          removePin(map.pageId, map.boxId, pin.id);
          close();
        }}
      >
        <Trash2 size={14} /> Remove pin
      </button>
    </div>
  );
}
