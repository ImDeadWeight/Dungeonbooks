/**
 * @file The Unfiled section pinned to the bottom of the sidebar: encounters
 * that belong to no campaign. Closed by default and always a drop target.
 */
import { useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { unfiledEncounters } from '../../domain/library/tree';
import { useLibrary } from '../../state/libraryStore';
import { ROOT_DROP_ID, UNFILED_NODE_ID } from './dnd';
import { EncounterNode } from './EncounterNode';
import { useNodeOpen, useTreeFilter } from './SidebarSearch';

/**
 * Small collapsible footer of the sidebar for encounters outside any campaign.
 * Collapsed by default; the header stays a drop target either way.
 */
export function UnfiledSection() {
  const filter = useTreeFilter();
  const encounters = useLibrary(useShallow(unfiledEncounters)).filter((e) => !filter || filter.visible.has(e.id));
  // Closed by default; a search opens it when an unfiled encounter matches.
  const { expanded: open, toggle } = useNodeOpen(UNFILED_NODE_ID, false, encounters.length > 0);
  const { setNodeRef, isOver, active } = useDroppable({ id: ROOT_DROP_ID, data: { type: 'root', id: 'root' } });
  const showTarget = isOver && active?.data.current?.type === 'encounter';

  return (
    <div ref={setNodeRef} className={`unfiled${showTarget ? ' drop-target' : ''}`}>
      <button className="unfiled-header" onClick={toggle} title={open ? 'Collapse' : 'Expand'}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Unfiled encounters ({encounters.length})
      </button>
      {open && (
        <div className="unfiled-list">
          {encounters.length === 0 && (
            <p className="muted unfiled-empty">{filter ? 'No unfiled encounters match.' : 'Drag an encounter here to unfile it.'}</p>
          )}
          {encounters.map((e) => <EncounterNode key={e.id} encounter={e} depth={0} />)}
        </div>
      )}
    </div>
  );
}
