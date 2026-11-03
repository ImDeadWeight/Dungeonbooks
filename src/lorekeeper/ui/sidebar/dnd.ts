/**
 * @file Sidebar drag-and-drop rules. Pages and folders can be dropped into a
 * folder or onto the top level. A folder dragged over the top or bottom edge
 * of another folder's row is placed before or after it instead, which is how
 * folders are reordered. A folder can't go inside itself.
 */
import {
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type Over,
} from '@dnd-kit/core';
import { create } from 'zustand';
import type { Id } from '../../domain/ids';
import { byFolderOrder, canMoveFolder } from '../../domain/notebook';
import { useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';

/** Data attached to a dragged row. */
export type DragItem = { type: 'page' | 'folder'; id: Id };
/**
 * Data attached to something that accepts drops: a folder row (with the
 * folder it sits in, for placing beside it), or the top level (folderId null).
 */
export type DropTarget = { folderId: Id | null; parentId?: Id | null };
/** Where on a folder row the drop lands: into the folder, or beside it. */
export type DropZone = 'inside' | 'before' | 'after';

/** Drop id of the tree's empty space (the top level). */
export const ROOT_DROP_ID = 'drop:root';
/** Share of a row's height, at its top and at its bottom, that places a folder beside it rather than inside. */
const EDGE = 0.3;

/** The droppable under the pointer; a folder row wins over the top-level area around it. */
export const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 1 ? hits.filter((h) => h.id !== ROOT_DROP_ID) : hits;
};

/** The zone under the pointer during a drag, so the row can show where the drop will land. */
export const useDropZone = create<{ overId: string | null; zone: DropZone }>(() => ({ overId: null, zone: 'inside' }));

/** The pointer's height on screen during a drag: where it started plus how far it has moved. */
function pointerY(event: DragMoveEvent | DragEndEvent): number | null {
  const start = event.activatorEvent;
  const touch = typeof TouchEvent !== 'undefined' && start instanceof TouchEvent;
  const y = start instanceof MouseEvent ? start.clientY : touch ? start.touches[0]?.clientY : undefined;
  return y === undefined ? null : y + event.delta.y;
}

/** True when a folder is showing anything below its row. */
function isOpenWithContents(folderId: Id): boolean {
  if (useUi.getState().collapsedFolders[folderId]) return false;
  const { folders, pages } = useNotebook.getState();
  return folders.some((f) => f.parentId === folderId) || pages.some((p) => p.folderId === folderId);
}

/**
 * Which zone of the row under the pointer a drop lands in. Only folders are
 * placed beside folders; the bottom edge of an open folder with contents
 * counts as inside, since its children are drawn right below it.
 */
function zoneOf(item: DragItem | undefined, over: Over | null, y: number | null): DropZone {
  const target = over?.data.current as DropTarget | undefined;
  if (item?.type !== 'folder' || !over || !target?.folderId || y === null) return 'inside';
  const share = (y - over.rect.top) / over.rect.height;
  if (share < EDGE) return 'before';
  if (share > 1 - EDGE && !isOpenWithContents(target.folderId)) return 'after';
  return 'inside';
}

/** Whether the dragged item may be dropped on the target, in the given zone. */
export function accepts(target: DropTarget, item: DragItem | undefined, zone: DropZone = 'inside'): boolean {
  if (!item) return false;
  if (item.type === 'page') return zone === 'inside';
  const folders = useNotebook.getState().folders;
  if (zone === 'inside') return canMoveFolder(folders, item.id, target.folderId);
  return target.folderId !== item.id && canMoveFolder(folders, item.id, target.parentId ?? null);
}

/** Keeps the drop-zone indicator in step with the pointer. */
export function handleDragMove(event: DragMoveEvent) {
  const overId = event.over ? String(event.over.id) : null;
  const zone = zoneOf(event.active.data.current as DragItem | undefined, event.over, pointerY(event));
  const current = useDropZone.getState();
  if (current.overId !== overId || current.zone !== zone) useDropZone.setState({ overId, zone });
}

/** Moves or places the dropped page/folder if the target accepts it, and opens the folder it landed in. */
export function handleDragEnd(event: DragEndEvent) {
  useDropZone.setState({ overId: null, zone: 'inside' });
  const item = event.active.data.current as DragItem | undefined;
  const target = event.over?.data.current as DropTarget | undefined;
  const zone = zoneOf(item, event.over, pointerY(event));
  if (!item || !target || !accepts(target, item, zone)) return;
  const notebook = useNotebook.getState();

  if (zone !== 'inside') {
    // Place beside the target folder, among the folders it sits with.
    const parentId = target.parentId ?? null;
    const level = notebook.folders.filter((f) => f.parentId === parentId && f.id !== item.id).sort(byFolderOrder);
    const index = level.findIndex((f) => f.id === target.folderId) + (zone === 'after' ? 1 : 0);
    notebook.placeFolder(item.id, parentId, index);
    if (parentId) useUi.getState().expandFolder(parentId);
    return;
  }

  if (item.type === 'folder') notebook.moveFolder(item.id, target.folderId);
  else notebook.movePage(item.id, target.folderId);
  if (target.folderId) useUi.getState().expandFolder(target.folderId);
}

/** Clears the drop-zone indicator when a drag is cancelled (e.g. Escape). */
export function handleDragCancel() {
  useDropZone.setState({ overId: null, zone: 'inside' });
}
