/**
 * @file A campaign row in the sidebar with its areas and loose encounters
 * beneath.
 */
import { useShallow } from 'zustand/react/shallow';
import type { Id } from '../../domain/ids';
import type { Campaign } from '../../domain/library/types';
import { areasOf, looseEncountersOf } from '../../domain/library/tree';
import { useLibrary } from '../../state/libraryStore';
import { exportItems } from '../../state/transferActions';
import { useUi } from '../../state/uiStore';
import { confirmThen } from '../common/ConfirmDialog';
import { AreaNode } from './AreaNode';
import { EncounterNode } from './EncounterNode';
import { useNodeOpen, useTreeFilter } from './SidebarSearch';
import { TreeChildren, TreeRow } from './TreeRow';

/** Collapsible campaign that accepts dropped areas and encounters; + creates an area or encounter in it. */
export function CampaignNode({ campaign }: { campaign: Campaign }) {
  const filter = useTreeFilter();
  const shown = (id: Id) => !filter || filter.visible.has(id);
  const areas = useLibrary(useShallow((s) => areasOf(s, campaign.id))).filter((a) => shown(a.id));
  const encounters = useLibrary(useShallow((s) => looseEncountersOf(s, campaign.id))).filter((e) => shown(e.id));
  const { expanded, toggle } = useNodeOpen(campaign.id);
  const { openModal } = useUi.getState();
  const { rename, deleteCampaign } = useLibrary.getState();

  // Delete the campaign and everything in it after confirming.
  const onDelete = () =>
    confirmThen(
      `Delete campaign "${campaign.name}" with all of its areas and encounters?`,
      'Delete',
      () => deleteCampaign(campaign.id),
    );

  return (
    <div className="tree-node">
      <TreeRow
        depth={0}
        label={campaign.name}
        expanded={expanded}
        onToggle={toggle}
        onAdd={() =>
          openModal({
            type: 'create',
            preset: { kind: null, allowedKinds: ['area', 'encounter'], campaignId: campaign.id, areaId: null },
          })
        }
        addTitle="New area or encounter in this campaign"
        onEdit={() => openModal({ type: 'editTreeItem', kind: 'campaign', id: campaign.id })}
        onExport={() => exportItems({ kind: 'campaign', id: campaign.id, name: campaign.name })}
        onDelete={onDelete}
        onRename={(name) => rename('campaign', campaign.id, name)}
        drop={{ type: 'campaign', id: campaign.id }}
      />
      {expanded && (
        <TreeChildren parentDepth={0}>
          {areas.map((a) => <AreaNode key={a.id} area={a} depth={1} />)}
          {encounters.map((e) => <EncounterNode key={e.id} encounter={e} depth={1} />)}
        </TreeChildren>
      )}
    </div>
  );
}
