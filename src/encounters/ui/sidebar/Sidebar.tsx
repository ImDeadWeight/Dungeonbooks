/**
 * @file The collapsible left panel: campaign tree, Unfiled section,
 * drag-and-drop between them, and a search box to narrow them down.
 */
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useMemo } from 'react';
import { filterLibrary } from '../../domain/library/tree';
import { useLibrary } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';
import { CampaignNode } from './CampaignNode';
import { handleDragEnd } from './dnd';
import { SidebarResizer, useSidebarWidth } from './SidebarResizer';
import { SidebarSearch, TreeFilterContext } from './SidebarSearch';
import { UnfiledSection } from './UnfiledSection';
import './sidebar.css';

/** Campaign tree with drag and drop, or a thin strip with an expand button when collapsed. */
export function Sidebar() {
  const campaigns = useLibrary((s) => s.campaigns);
  const areas = useLibrary((s) => s.areas);
  const encounters = useLibrary((s) => s.encounters);
  const search = useUi((s) => s.sidebarSearch);
  const filter = useMemo(() => filterLibrary({ campaigns, areas, encounters }, search), [campaigns, areas, encounters, search]);
  const shownCampaigns = filter ? campaigns.filter((c) => filter.visible.has(c.id)) : campaigns;
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
        <h3>Campaigns</h3>
        <span className="spacer" />
        <button className="icon" onClick={toggleSidebar} title="Hide encounters">
          <PanelLeftClose size={18} />
        </button>
      </div>
      <SidebarSearch />
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <TreeFilterContext.Provider value={filter}>
          <div className="panel-body">
            {campaigns.length === 0 && <p className="empty-state">Use the + button above to create a campaign.</p>}
            {filter?.visible.size === 0 && <p className="empty-state">No campaigns, areas or encounters match.</p>}
            {shownCampaigns.map((c) => <CampaignNode key={c.id} campaign={c} />)}
          </div>
          <UnfiledSection />
        </TreeFilterContext.Provider>
      </DndContext>
      <SidebarResizer width={width} onChange={setWidth} />
    </aside>
  );
}
