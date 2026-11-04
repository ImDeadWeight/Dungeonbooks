/**
 * @file Choosing the page a new pin points at: type to search (typos
 * forgiven, recently opened pages first), or make a page by that name.
 */
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Id } from '../../domain/ids';
import { searchablePages, searchPages } from '../../domain/pageSearch';
import { useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';
import { PageTypeIcon } from '../page/pageTypes';

interface Props {
  /** The map's page (never offered). */
  pageId: Id;
  /** Where to show it, in the map frame (px). */
  x: number;
  y: number;
  choose(pageId: Id): void;
  cancel(): void;
}

export function PinPicker({ pageId, x, y, choose, cancel }: Props) {
  const pages = useNotebook((s) => s.pages);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const page = pages.find((p) => p.id === pageId);
  const results = searchPages(query, searchablePages(pages), {
    currentPageId: pageId,
    folderId: page?.folderId ?? null,
    recentPageIds: useUi.getState().recentPageIds,
  });
  const canCreate = query.trim().length > 0;
  const count = results.length + (canCreate ? 1 : 0);

  const pick = (i: number) => {
    if (i < results.length) return choose(results[i].pageId);
    if (canCreate) choose(useNotebook.getState().addPage(page?.folderId ?? null, query.trim()));
  };

  return (
    <div className="pin-picker" style={{ left: x, top: y }} onPointerDown={(e) => e.stopPropagation()}>
      <input
        autoFocus
        placeholder="Pin which page?"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel();
          if (e.key === 'ArrowDown') setActive((a) => Math.min(count - 1, a + 1));
          if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            pick(active);
          }
        }}
      />
      <ul>
        {results.map((r, i) => (
          <li key={r.pageId}>
            <button className={i === active ? 'active' : undefined} onClick={() => pick(i)}>
              <PageTypeIcon type={r.type} size={13} /> {r.name}
            </button>
          </li>
        ))}
        {canCreate && (
          <li>
            <button className={active === results.length ? 'active' : undefined} onClick={() => pick(results.length)}>
              <Plus size={13} /> New page "{query.trim()}"
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
