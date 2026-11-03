/**
 * @file An area row in the sidebar with its nested areas and encounters
 * beneath.
 */
import { useShallow } from 'zustand/react/shallow';
import type { Id } from '../../domain/ids';
import type { Area } from '../../domain/library/types';
import { areaContents, childAreasOf, encountersOfArea } from '../../domain/library/tree';
import { useLibrary } from '../../state/libraryStore';
import { exportItems } from '../../state/transferActions';
import { useUi } from '../../state/uiStore';
import { confirmThen } from '../common/ConfirmDialog';
import { EncounterNode } from './EncounterNode';
import { useNodeOpen, useTreeFilter } from './SidebarSearch';
import { TreeChildren, TreeRow } from './TreeRow';

/** Collapsible, draggable area that accepts dropped areas and encounters; + creates an area or encounter in it. */
export function AreaNode({ area, depth }: { area: Area; depth: number }) {
  const filter = useTreeFilter();
  const shown = (id: Id) => !filter || filter.visible.has(id);
  const children = useLibrary(useShallow((s) => childAreasOf(s, area.id))).filter((a) => shown(a.id));
  const encounters = useLibrary(useShallow((s) => encountersOfArea(s, area.id))).filter((e) => shown(e.id));
  const { expanded, toggle } = useNodeOpen(area.id);
  const { openModal } = useUi.getState();
  const { rename, deleteArea } = useLibrary.getState();

  // Delete the area and everything nested in it after confirming.
  const onDelete = () => {
    const inside = areaContents(useLibrary.getState(), area.id);
    const nested = inside.areas > 0 ? `${inside.areas} nested area(s) and ` : '';
    confirmThen(
      `Delete area "${area.name}" with its ${nested}${inside.encounters} encounter(s)?`,
      'Delete',
      () => deleteArea(area.id),
    );
  };

  return (
    <div className="tree-node">
      <TreeRow
        depth={depth}
        label={area.name}
        expanded={expanded}
        onToggle={toggle}
        onAdd={() =>
          openModal({
            type: 'create',
            preset: { kind: null, allowedKinds: ['area', 'encounter'], campaignId: area.campaignId, areaId: area.id },
          })
        }
        addTitle="New area or encounter in this area"
        onEdit={() => openModal({ type: 'editTreeItem', kind: 'area', id: area.id })}
        onExport={() => exportItems({ kind: 'area', id: area.id, name: area.name })}
        onDelete={onDelete}
        onRename={(name) => rename('area', area.id, name)}
        drag={{ type: 'area', id: area.id }}
        drop={{ type: 'area', id: area.id }}
      />
      {expanded && (
        <TreeChildren parentDepth={depth}>
          {children.map((a) => <AreaNode key={a.id} area={a} depth={depth + 1} />)}
          {encounters.map((e) => <EncounterNode key={e.id} encounter={e} depth={depth + 1} />)}
        </TreeChildren>
      )}
    </div>
  );
}
