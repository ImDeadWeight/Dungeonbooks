/**
 * @file Sidebar drag-and-drop rules: what can be dragged, where it can go, and
 * applying a drop.
 */
import type { DragEndEvent } from '@dnd-kit/core';
import type { Id } from '../../domain/ids';
import { useCampaigns } from '../../../campaigns/campaignStore';
import { canMoveArea } from '../../domain/library/tree';
import { useLibrary } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';

/** Data attached to a dragged row. */
export type DragItem = { type: 'encounter' | 'area'; id: Id };
/** Data attached to a row, or the campaign's empty space, that accepts drops. */
export type DropTarget = { type: 'campaign' | 'area'; id: Id };

/** Areas go into the campaign or other areas (not into themselves or their own sub-areas); encounters can go anywhere. */
export function accepts(target: DropTarget, item: DragItem | undefined): boolean {
  if (!item) return false;
  if (item.type === 'area') {
    const dest = target.type === 'campaign'
      ? { kind: 'campaign' as const, campaignId: target.id }
      : { kind: 'area' as const, areaId: target.id };
    return canMoveArea({ ...useLibrary.getState(), campaigns: useCampaigns.getState().campaigns }, item.id, dest);
  }
  return true;
}

/** Moves the dropped area/encounter if the target accepts it. */
export function handleDragEnd(event: DragEndEvent) {
  const item = event.active.data.current as DragItem | undefined;
  const target = event.over?.data.current as DropTarget | undefined;
  if (!item || !target || !accepts(target, item)) return;
  const lib = useLibrary.getState();
  if (item.type === 'area') {
    if (target.type === 'campaign') lib.moveArea(item.id, { kind: 'campaign', campaignId: target.id });
    if (target.type === 'area') {
      lib.moveArea(item.id, { kind: 'area', areaId: target.id });
      // Expand a collapsed target so the moved area stays visible.
      const ui = useUi.getState();
      if (ui.collapsedNodes[target.id]) ui.toggleNode(target.id);
    }
    return;
  }
  if (target.type === 'campaign') lib.moveEncounter(item.id, { kind: 'campaign', campaignId: target.id });
  if (target.type === 'area') lib.moveEncounter(item.id, { kind: 'area', areaId: target.id });
}
