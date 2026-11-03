/**
 * @file The sidebar's search box, and what the tree needs to follow it: which
 * rows to show, which campaigns and areas to open, and the matched text to
 * mark.
 */
import { Search, X } from 'lucide-react';
import { createContext, useContext } from 'react';
import type { Id } from '../../domain/ids';
import type { TreeFilter } from '../../domain/library/tree';
import { useUi } from '../../state/uiStore';

/** The current search's filter for the tree below; null when not searching. */
export const TreeFilterContext = createContext<TreeFilter | null>(null);

/** The search's filter, or null when the whole tree shows. */
export function useTreeFilter() {
  return useContext(TreeFilterContext);
}

/**
 * Whether a tree node shows its contents. While searching, nodes leading to a
 * match open (or `opensForSearch` decides), and toggling only lasts for that
 * search; the saved folds stay as the user left them. `defaultOpen` is how
 * the node starts when never toggled (the Unfiled section starts closed).
 */
export function useNodeOpen(id: Id, defaultOpen = true, opensForSearch?: boolean): { expanded: boolean; toggle: () => void } {
  const filter = useTreeFilter();
  const saved = useUi((s) => defaultOpen !== !!s.collapsedNodes[id]);
  const flipped = useUi((s) => !!s.searchToggled[id]);
  if (!filter) return { expanded: saved, toggle: () => useUi.getState().toggleNode(id) };
  const opened = opensForSearch ?? filter.opened.has(id);
  return { expanded: (opened || saved) !== flipped, toggle: () => useUi.getState().toggleSearchNode(id) };
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
        placeholder="Search encounters and areas"
        aria-label="Search campaigns, areas and encounters"
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
