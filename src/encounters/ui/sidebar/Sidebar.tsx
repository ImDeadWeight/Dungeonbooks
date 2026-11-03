/**
 * @file The collapsible left panel: the open campaign's areas and encounters,
 * with drag and drop between them and a search box to narrow them down.
 */
import { DndContext, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCampaigns } from '../../../campaigns/campaignStore';
import type { Id } from '../../domain/ids';
import { areasOf, filterCampaign, looseEncountersOf } from '../../domain/library/tree';
import { useLibrary } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';
import { AreaNode } from './AreaNode';
import { accepts, handleDragEnd, type DragItem, type DropTarget } from './dnd';
import { EncounterNode } from './EncounterNode';
import { SidebarResizer, useSidebarWidth } from './SidebarResizer';
import { SidebarSearch, TreeFilterContext, useTreeFilter } from './SidebarSearch';
import './sidebar.css';

/** The campaign's tree, or a thin strip with an expand button when collapsed. */
export function Sidebar() {
  const campaignId = useCampaigns((s) => s.activeId)!;
  const areas = useLibrary((s) => s.areas);
  const encounters = useLibrary((s) => s.encounters);
  const search = useUi((s) => s.sidebarSearch);
  const filter = useMemo(() => filterCampaign({ areas, encounters }, campaignId, search), [areas, encounters, campaignId, search]);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggleSidebar = useUi((s) => s.toggleSidebar);
  const { width, setWidth, style } = useSidebarWidth();
  // Mouse drags start after 6px so clicks still work. Touch (and touchpad gestures that arrive as touch) only
  // picks a row up after a 250ms hold, so swipes scroll the list instead of moving things.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  if (collapsed) {
    return (
      <aside className="panel sidebar collapsed">
        <button className="icon" onClick={toggleSidebar} title="Show encounters">
          <PanelLeftOpen size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="panel sidebar" style={style}>
      <div className="panel-header">
        <h3>Encounters</h3>
        <span className="spacer" />
        <button
          className="icon"
          title="New area or encounter"
          onClick={() =>
            useUi.getState().openModal({
              type: 'create',
              preset: { kind: null, allowedKinds: ['area', 'encounter'], campaignId, areaId: null },
            })
          }
        >
          <Plus size={18} />
        </button>
        <button className="icon" onClick={toggleSidebar} title="Hide encounters">
          <PanelLeftClose size={18} />
        </button>
      </div>
      <SidebarSearch />
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <TreeFilterContext.Provider value={filter}>
          <CampaignTree campaignId={campaignId} />
        </TreeFilterContext.Provider>
      </DndContext>
      <SidebarResizer width={width} onChange={setWidth} />
    </aside>
  );
}

/** The campaign's top-level areas and encounters. Dropping on empty space puts things directly in the campaign. */
function CampaignTree({ campaignId }: { campaignId: Id }) {
  const filter = useTreeFilter();
  const shown = (id: Id) => !filter || filter.visible.has(id);
  const allAreas = useLibrary(useShallow((s) => areasOf(s, campaignId)));
  const allEncounters = useLibrary(useShallow((s) => looseEncountersOf(s, campaignId)));
  const areas = allAreas.filter((a) => shown(a.id));
  const encounters = allEncounters.filter((e) => shown(e.id));
  const target: DropTarget = { type: 'campaign', id: campaignId };
  const { setNodeRef, isOver, active } = useDroppable({ id: `drop:campaign:${campaignId}`, data: target });
  const showTarget = isOver && accepts(target, active?.data.current as DragItem | undefined);

  return (
    <div ref={setNodeRef} className={`panel-body campaign-tree${showTarget ? ' drop-target' : ''}`}>
      {allAreas.length === 0 && allEncounters.length === 0 && (
        <p className="empty-state">No areas or encounters yet. Use the + button above to create one.</p>
      )}
      {filter?.visible.size === 0 && <p className="empty-state">No areas or encounters match.</p>}
      {areas.map((a) => <AreaNode key={a.id} area={a} depth={0} />)}
      {encounters.map((e) => <EncounterNode key={e.id} encounter={e} depth={0} />)}
    </div>
  );
}
