/**
 * @file The collapsible left panel: nested folders and pages, with drag and
 * drop to reorganise them and a search box to narrow them down.
 */
import { DndContext, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { FilePlus, Folder, FolderOpen, FolderPlus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useMemo } from 'react';
import type { Id } from '../../domain/ids';
import { byFolderOrder, byName, descendantFolderIds, filterTree, pageType, type Folder as FolderModel, type Page } from '../../domain/notebook';
import { PageTypeIcon } from '../page/pageTypes';
import { useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';
import { accepts, collisionDetection, handleDragCancel, handleDragEnd, handleDragMove, ROOT_DROP_ID, type DragItem } from './dnd';
import { SidebarResizer, useSidebarWidth } from './SidebarResizer';
import { SidebarSearch, TreeFilterContext, useFolderOpen, useTreeFilter } from './SidebarSearch';
import { TreeChildren, TreeRow } from './TreeRow';
import './sidebar.css';

/** Creates a page (inside a folder, or at the top level), opens it and selects its title for typing. */
export function createPage(folderId: Id | null) {
  const id = useNotebook.getState().addPage(folderId);
  const ui = useUi.getState();
  // The new page wouldn't match the search, so end it.
  ui.setSidebarSearch('');
  if (folderId) ui.expandFolder(folderId);
  ui.selectPage(id);
  ui.setFocusTitle(id);
}

/** Creates a folder and opens its parent so it shows (ending any search, which it wouldn't match). */
function createFolder(parentId: Id | null) {
  useNotebook.getState().addFolder(parentId);
  useUi.getState().setSidebarSearch('');
  if (parentId) useUi.getState().expandFolder(parentId);
}

/** Asks before deleting a folder with everything inside it. */
function confirmDeleteFolder(folder: FolderModel) {
  const { folders, pages } = useNotebook.getState();
  const inside = new Set([folder.id, ...descendantFolderIds(folders, folder.id)]);
  const pageCount = pages.filter((p) => p.folderId && inside.has(p.folderId)).length;
  useUi.getState().askConfirm({
    message:
      inside.size === 1 && pageCount === 0
        ? `Delete the empty folder "${folder.name}"?`
        : `Delete "${folder.name}" with ${inside.size - 1} folder(s) and ${pageCount} page(s) inside it? Links to those pages will stop working.`,
    confirmLabel: 'Delete folder',
    onConfirm: () => useNotebook.getState().deleteFolder(folder.id),
  });
}

/** Asks before deleting a page. */
function confirmDeletePage(page: Page) {
  useUi.getState().askConfirm({
    message: `Delete the page "${page.title}"? Links to it will stop working.`,
    confirmLabel: 'Delete page',
    onConfirm: () => {
      useNotebook.getState().deletePage(page.id);
      if (useUi.getState().selectedPageId === page.id) useUi.getState().selectPage(null);
    },
  });
}

/** Sub-folders (as arranged) then pages (alphabetical) directly inside a folder or the top level (only search results while searching). */
function useChildren(folderId: Id | null) {
  const folders = useNotebook((s) => s.folders);
  const pages = useNotebook((s) => s.pages);
  const filter = useTreeFilter();
  const shown = (id: Id) => !filter || filter.visible.has(id);
  return {
    folders: folders.filter((f) => f.parentId === folderId && shown(f.id)).sort(byFolderOrder),
    pages: pages.filter((p) => p.folderId === folderId && shown(p.id)).sort((a, b) => byName(a.title, b.title)),
  };
}

/** A page's row. */
function PageNode({ page, depth }: { page: Page; depth: number }) {
  const selected = useUi((s) => s.selectedPageId === page.id);
  return (
    <div className="tree-node leaf">
      <TreeRow
        depth={depth}
        label={page.title}
        icon={<PageTypeIcon type={pageType(page)} />}
        drag={{ type: 'page', id: page.id }}
        selected={selected}
        onSelect={() => useUi.getState().selectPage(page.id)}
        onDelete={() => confirmDeletePage(page)}
        onRename={(title) => useNotebook.getState().renamePage(page.id, title)}
      />
    </div>
  );
}

/** Folders then pages inside a folder (or the top level). */
function Contents({ folderId, depth }: { folderId: Id | null; depth: number }) {
  const { folders, pages } = useChildren(folderId);
  return (
    <>
      {folders.map((f) => <FolderNode key={f.id} folder={f} depth={depth} />)}
      {pages.map((p) => <PageNode key={p.id} page={p} depth={depth} />)}
    </>
  );
}

/** A folder's row and, when expanded, everything inside it. */
function FolderNode({ folder, depth }: { folder: FolderModel; depth: number }) {
  const { expanded, toggle } = useFolderOpen(folder.id);
  return (
    <div className="tree-node">
      <TreeRow
        depth={depth}
        label={folder.name}
        icon={expanded ? <FolderOpen size={15} /> : <Folder size={15} />}
        drag={{ type: 'folder', id: folder.id }}
        drop={{ folderId: folder.id, parentId: folder.parentId }}
        expanded={expanded}
        onToggle={toggle}
        onAddPage={() => createPage(folder.id)}
        onAddFolder={() => createFolder(folder.id)}
        onSetPageType={() => useUi.getState().setPageTypeFolder(folder.id)}
        onDelete={() => confirmDeleteFolder(folder)}
        onRename={(name) => useNotebook.getState().renameFolder(folder.id, name)}
      />
      {expanded && (
        <TreeChildren parentDepth={depth}>
          <Contents folderId={folder.id} depth={depth + 1} />
        </TreeChildren>
      )}
    </div>
  );
}

/** The scrolling tree; empty space in it is the drop target for "move to top level". */
function TreeBody() {
  const isEmpty = useNotebook((s) => s.folders.length === 0 && s.pages.length === 0);
  const filter = useTreeFilter();
  const root = useDroppable({ id: ROOT_DROP_ID, data: { folderId: null } });
  const isTarget = root.isOver && accepts({ folderId: null }, root.active?.data.current as DragItem);
  return (
    <div ref={root.setNodeRef} className={`panel-body tree-body${isTarget ? ' drop-target' : ''}`}>
      {isEmpty && <p className="empty-state">Use the buttons above to create a folder or page.</p>}
      {!isEmpty && filter?.visible.size === 0 && <p className="empty-state">No pages or folders match.</p>}
      <Contents folderId={null} depth={0} />
    </div>
  );
}

/** Folder/page tree, or a thin strip with an expand button when collapsed. */
export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggleSidebar = useUi((s) => s.toggleSidebar);
  const { width, setWidth, style } = useSidebarWidth();
  const folders = useNotebook((s) => s.folders);
  const pages = useNotebook((s) => s.pages);
  const search = useUi((s) => s.sidebarSearch);
  const filter = useMemo(() => filterTree(folders, pages, search), [folders, pages, search]);
  // Mouse drags start after 6px so clicks still work. Touch (and touchpad gestures that arrive as touch) only
  // picks a row up after a 250ms hold, so swipes scroll the list instead of moving things.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  if (collapsed) {
    return (
      <aside className="panel sidebar collapsed">
        <button className="icon" onClick={toggleSidebar} title="Show pages">
          <PanelLeftOpen size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="panel sidebar" style={style}>
      <div className="panel-header">
        <h3>Notebook</h3>
        <span className="spacer" />
        <button className="icon" onClick={() => createPage(null)} title="New page">
          <FilePlus size={17} />
        </button>
        <button className="icon" onClick={() => createFolder(null)} title="New folder">
          <FolderPlus size={17} />
        </button>
        <button className="icon" onClick={toggleSidebar} title="Hide pages">
          <PanelLeftClose size={18} />
        </button>
      </div>
      <SidebarSearch />
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <TreeFilterContext.Provider value={filter}>
          <TreeBody />
        </TreeFilterContext.Provider>
      </DndContext>
      <SidebarResizer width={width} onChange={setWidth} />
    </aside>
  );
}
