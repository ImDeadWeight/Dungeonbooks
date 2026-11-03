/**
 * @file One row of the sidebar tree: chevron, name (double-click to rename),
 * inline action buttons, drag and drop.
 */
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, Download, PencilLine, Plus, Trash2 } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { accepts, type DragItem, type DropTarget } from './dnd';
import { Highlighted } from './SidebarSearch';

/** Left padding of a top-level row (px). */
const BASE_INDENT = 6;
/** Extra indent per tree level (px). */
const INDENT_STEP = 16;
/** Horizontal centre of a row's chevron: 3px selection border + padding + 4px button padding + half the 16px icon. */
const CHEVRON_CENTRE = 3 + BASE_INDENT + 4 + 8;

/**
 * Wraps a node's children. Each child (a `.tree-node`) draws a thin L-shaped
 * guide from the parent's chevron (see sidebar.css); the vertical line stops
 * at the last child.
 */
export function TreeChildren({ parentDepth, children }: { parentDepth: number; children: ReactNode }) {
  const style = { '--guide-x': `${CHEVRON_CENTRE + parentDepth * INDENT_STEP}px` } as CSSProperties;
  return (
    <div className="tree-children" style={style}>
      {children}
    </div>
  );
}

/** Props for TreeRow; optional handlers decide which buttons appear. */
interface Props {
  depth: number;
  label: string;
  expanded?: boolean;
  onToggle?: () => void;
  onSelect?: () => void;
  selected?: boolean;
  onAdd?: () => void;
  addTitle?: string;
  onEdit?: () => void;
  onExport?: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  drag?: DragItem;
  drop?: DropTarget;
  badge?: ReactNode;
}

/** One line of the sidebar tree: chevron, name (double-click to rename), inline actions. */
export function TreeRow(props: Props) {
  const { depth, label, expanded, onToggle, onSelect, selected, onAdd, addTitle, onEdit, onExport, onDelete, onRename, drag, drop, badge } = props;
  const [editing, setEditing] = useState(false);
  // dnd-kit needs unique ids even for disabled registrations.
  const key = drag?.id ?? drop?.id ?? label;
  const dragId = drag ? `drag:${drag.type}:${drag.id}` : `nodrag:${key}`;
  const dropId = drop ? `drop:${drop.type}:${drop.id}` : `nodrop:${key}`;
  const draggable = useDraggable({ id: dragId, data: drag, disabled: !drag || editing });
  const droppable = useDroppable({ id: dropId, data: drop, disabled: !drop });
  // Highlight while something this row accepts is dragged over it.
  const isTarget = droppable.isOver && drop && accepts(drop, droppable.active?.data.current as DragItem);

  // The row element is both draggable and a drop target.
  const setRefs = (el: HTMLDivElement | null) => {
    draggable.setNodeRef(el);
    droppable.setNodeRef(el);
  };

  // Finish inline renaming; ignores blank or unchanged names.
  const commit = (value: string) => {
    setEditing(false);
    if (value.trim() && value.trim() !== label) onRename(value.trim());
  };

  return (
    <div
      ref={setRefs}
      className={`tree-row${selected ? ' selected' : ''}${isTarget ? ' drop-target' : ''}${draggable.isDragging ? ' dragging' : ''}`}
      style={{ paddingLeft: BASE_INDENT + depth * INDENT_STEP }}
      onClick={onSelect ?? onToggle}
      // Spread only when draggable: otherwise dnd-kit marks the row (and its buttons) aria-disabled.
      {...(drag && !editing ? { ...draggable.listeners, ...draggable.attributes } : {})}
    >
      {onToggle ? (
        <button className="icon" onClick={(e) => { e.stopPropagation(); onToggle(); }} title={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ) : (
        <span className="tree-indent" />
      )}
      {editing ? (
        <input
          autoFocus
          defaultValue={label}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit(e.currentTarget.value);
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
        />
      ) : (
        <span className="tree-label" title="Double-click to rename" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
          <Highlighted text={label} />
        </span>
      )}
      {badge}
      <span className="tree-actions">
        {onEdit && (
          <button className="icon" title="Edit name and placement" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <PencilLine size={15} />
          </button>
        )}
        {onAdd && (
          <button className="icon" title={addTitle} onClick={(e) => { e.stopPropagation(); onAdd(); }}>
            <Plus size={15} />
          </button>
        )}
        {onExport && (
          <button className="icon" title="Export to file" onClick={(e) => { e.stopPropagation(); onExport(); }}>
            <Download size={15} />
          </button>
        )}
        <button className="icon" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 size={15} />
        </button>
      </span>
    </div>
  );
}
