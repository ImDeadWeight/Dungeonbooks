/**
 * @file One row of the sidebar tree: chevron, icon, name (rename from the ⋯
 * menu or with a double-click), a folder's New page button, the ⋯ menu of
 * actions, drag and drop.
 */
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, ClipboardCopy, FilePlus, FolderPlus, Pencil, Shapes, Trash2 } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { MoreMenu, type MenuItem } from '../common/MoreMenu';
import { accepts, useDropZone, type DragItem, type DropTarget } from './dnd';
import { Highlighted } from './SidebarSearch';

/** Left padding of a top-level row (px). */
const BASE_INDENT = 6;
/** Extra indent per tree level (px). */
const INDENT_STEP = 16;
/** Horizontal centre of a row's chevron: 3px selection border + padding + 4px button padding + half the 16px icon. */
const CHEVRON_CENTRE = 3 + BASE_INDENT + 4 + 8;

/**
 * Wraps a folder's children. Each child (a `.tree-node`) draws a thin
 * L-shaped guide from the parent's chevron (see sidebar.css).
 */
export function TreeChildren({ parentDepth, children }: { parentDepth: number; children: ReactNode }) {
  const style = { '--guide-x': `${CHEVRON_CENTRE + parentDepth * INDENT_STEP}px` } as CSSProperties;
  return (
    <div className="tree-children" style={style}>
      {children}
    </div>
  );
}

/** Props for TreeRow; optional handlers decide which actions its menu has. */
interface Props {
  depth: number;
  label: string;
  icon: ReactNode;
  drag: DragItem;
  /** Folders accept pages and folders; pages accept pages. */
  drop?: DropTarget;
  expanded?: boolean;
  onToggle?: () => void;
  selected?: boolean;
  onSelect?: () => void;
  onAddPage?: () => void;
  /** Pages: a new page under this one (in the ⋯ menu only). */
  onAddChildPage?: () => void;
  onAddFolder?: () => void;
  /** Folders: set the type of every page inside. */
  onSetPageType?: () => void;
  /** Folders, and pages with pages under them: everything inside as Markdown, for Copy as Markdown. */
  copyMarkdown?: () => string;
  onDelete: () => void;
  onRename: (name: string) => void;
}

/** One line of the sidebar tree. */
export function TreeRow(props: Props) {
  const { depth, label, icon, drag, drop, expanded, onToggle, selected, onSelect, onAddPage, onAddChildPage, onAddFolder, onSetPageType, copyMarkdown, onDelete, onRename } =
    props;
  const [editing, setEditing] = useState(false);
  const draggable = useDraggable({ id: `drag:${drag.type}:${drag.id}`, data: drag, disabled: editing });
  const dropId = `drop:${drag.id}`;
  const droppable = useDroppable({ id: dropId, data: drop, disabled: !drop });
  const zone = useDropZone((s) => (s.overId === dropId ? s.zone : null));
  // While something this row accepts is dragged over it: an outline for "into", a line for "before"/"after".
  const isTarget = droppable.isOver && drop && zone && accepts(drop, droppable.active?.data.current as DragItem, zone);
  const dropClass = isTarget ? (zone === 'inside' ? ' drop-target' : ` drop-${zone}`) : '';

  // The row element is both draggable and a drop target.
  const setRefs = (el: HTMLDivElement | null) => {
    draggable.setNodeRef(el);
    droppable.setNodeRef(el);
  };

  // The row's actions, in its ⋯ menu; which appear depends on the handlers given.
  const menu: MenuItem[] = [
    { label: 'Rename', icon: Pencil, onSelect: () => setEditing(true) },
    ...(onAddPage ? [{ label: 'New page here', icon: FilePlus, onSelect: onAddPage }] : []),
    ...(onAddChildPage ? [{ label: 'New page under this one', icon: FilePlus, onSelect: onAddChildPage }] : []),
    ...(onAddFolder ? [{ label: 'New folder here', icon: FolderPlus, onSelect: onAddFolder }] : []),
    ...(onSetPageType ? [{ label: 'Set page type inside…', icon: Shapes, onSelect: onSetPageType }] : []),
    ...(copyMarkdown
      ? [{ label: 'Copy as Markdown', icon: ClipboardCopy, doneLabel: 'Copied', onSelect: () => navigator.clipboard.writeText(copyMarkdown()) }]
      : []),
    { label: 'Delete…', icon: Trash2, danger: true, onSelect: onDelete },
  ];

  // Finish inline renaming; ignores blank or unchanged names.
  const commit = (value: string) => {
    setEditing(false);
    if (value.trim() && value.trim() !== label) onRename(value.trim());
  };

  return (
    <div
      ref={setRefs}
      className={`tree-row${selected ? ' selected' : ''}${dropClass}${draggable.isDragging ? ' dragging' : ''}`}
      style={{ paddingLeft: BASE_INDENT + depth * INDENT_STEP }}
      onClick={onSelect ?? onToggle}
      {...(!editing ? { ...draggable.listeners, ...draggable.attributes } : {})}
    >
      {onToggle ? (
        <button className="icon" onClick={(e) => { e.stopPropagation(); onToggle(); }} title={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ) : (
        <span className="tree-indent" />
      )}
      <span className="tree-icon">{icon}</span>
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
      <span className="tree-actions">
        {/* The one action common enough to keep on the row as well. */}
        {onAddPage && (
          <button className="icon" title="New page here" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onAddPage(); }}>
            <FilePlus size={15} />
          </button>
        )}
        <MoreMenu items={menu} title="Actions" />
      </span>
    </div>
  );
}
