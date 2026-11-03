/**
 * @file An encounter row in the sidebar.
 */
import type { Encounter } from '../../domain/library/types';
import { useLibrary } from '../../state/libraryStore';
import { exportItems } from '../../state/transferActions';
import { useUi } from '../../state/uiStore';
import { confirmThen } from '../common/ConfirmDialog';
import { CrossedSwordsIcon } from '../common/SwordIcons';
import { TreeRow } from './TreeRow';

/** Selectable, draggable encounter with edit/export/delete buttons and a crossed-swords badge in combat. */
export function EncounterNode({ encounter, depth }: { encounter: Encounter; depth: number }) {
  const selected = useUi((s) => s.selectedEncounterId === encounter.id);
  const selectEncounter = useUi((s) => s.selectEncounter);
  const { rename, deleteEncounter } = useLibrary.getState();

  // Delete after confirming (warns if combat is active).
  const onDelete = () => {
    const warning = encounter.combat.active ? ' Combat in it is still active.' : '';
    confirmThen(`Delete encounter "${encounter.name}"?${warning}`, 'Delete', () => deleteEncounter(encounter.id));
  };

  return (
    <div className="tree-node leaf">
      <TreeRow
        depth={depth}
        label={encounter.name}
        selected={selected}
        onSelect={() => selectEncounter(encounter.id)}
        onEdit={() => useUi.getState().openModal({ type: 'editTreeItem', kind: 'encounter', id: encounter.id })}
        onExport={() => exportItems({ kind: 'encounter', id: encounter.id, name: encounter.name })}
        onDelete={onDelete}
        onRename={(name) => rename('encounter', encounter.id, name)}
        drag={{ type: 'encounter', id: encounter.id }}
        badge={encounter.combat.active ? <span className="tree-badge"><CrossedSwordsIcon size={14} /></span> : undefined}
      />
    </div>
  );
}
