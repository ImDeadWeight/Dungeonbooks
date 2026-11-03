/**
 * @file The sidebar's search box, and what the tree needs to follow it: which
 * rows to show, which folders to open, and the matched text to mark.
 */
import { Search, X } from 'lucide-react';
import { createContext, useContext } from 'react';
import type { Id } from '../../domain/ids';
import type { TreeFilter } from '../../domain/notebook';
import { useUi } from '../../state/uiStore';

/** The current search's filter for the tree below; null when not searching. */
export const TreeFilterContext = createContext<TreeFilter | null>(null);

/** The search's filter, or null when the whole tree shows. */
export function useTreeFilter() {
  return useContext(TreeFilterContext);
}

/**
 * Whether a folder shows its contents. While searching, folders leading to a
 * match open, and toggling only lasts for that search; the saved folds stay
 * as the user left them.
 */
export function useFolderOpen(id: Id): { expanded: boolean; toggle: () => void } {
  const filter = useTreeFilter();
  const saved = useUi((s) => !s.collapsedFolders[id]);
  const flipped = useUi((s) => !!s.searchToggled[id]);
  if (!filter) return { expanded: saved, toggle: () => useUi.getState().toggleFolder(id) };
  return { expanded: (filter.opened.has(id) || saved) !== flipped, toggle: () => useUi.getState().toggleSearchFolder(id) };
}

/** A name with the part matching the search marked. */
export function Highlighted({ text }: { text: string }) {
  const query = useUi((s) => s.sidebarSearch.trim().toLowerCase());
  const at = query ? text.toLowerCase().indexOf(query) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

/** Search box filtering the tree as you type; Escape clears it. */
export function SidebarSearch() {
  const text = useUi((s) => s.sidebarSearch);
  const setText = useUi((s) => s.setSidebarSearch);
  return (
    <div className="sidebar-search">
      <Search size={15} className="sidebar-search-icon" />
      <input
        value={text}
        placeholder="Search pages and folders"
        aria-label="Search pages and folders"
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setText('');
        }}
      />
      {text && (
        <button className="icon" onClick={() => setText('')} title="Clear search">
          <X size={15} />
        </button>
      )}
    </div>
  );
}
