/**
 * @file Where characters belong: the Belongs to field on a Character page
 * (the places and factions it is part of), and the list of those characters
 * on each Place and Faction page. Clicking a name peeks at its page;
 * Ctrl+click opens it.
 */
import { X } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { Id } from '../../domain/ids';
import { groupOptions, groupsOf, isGroup, membersOf, pageType, type Page } from '../../domain/notebook';
import { useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';
import { PageTypeIcon } from './pageTypes';

/** Peeks at a page next to the clicked name, or opens it with Ctrl. */
function showPage(e: MouseEvent, pageId: Id) {
  const ui = useUi.getState();
  if (e.ctrlKey || e.metaKey) ui.selectPage(pageId);
  else ui.openPeek({ pageId, x: e.clientX, y: e.clientY });
}

/** Changes which places and factions a character belongs to. */
function setBelongsTo(page: Page, ids: Id[]) {
  useNotebook.getState().setPageInfo([page.id], (current) => {
    if (current?.type !== 'character') return current;
    const { belongsTo: _old, ...rest } = current;
    return ids.length ? { ...rest, belongsTo: ids } : rest;
  });
}

/** Character pages: the places and factions the character belongs to, with a picker to add more. */
export function BelongsToField({ page }: { page: Page }) {
  const pages = useNotebook((s) => s.pages);
  const groups = groupsOf(pages, page);
  const options = groupOptions(pages, page);
  const ids = groups.map((g) => g.id);

  return (
    <span className="page-info-field belongs-to">
      <span className="muted">Belongs to</span>
      {groups.map((g) => (
        <span key={g.id} className="page-chip">
          <button className="page-chip-name" title="Click to peek, Ctrl+click to open" onClick={(e) => showPage(e, g.id)}>
            <PageTypeIcon type={pageType(g)} size={13} />
            {g.title}
          </button>
          <button className="icon page-chip-remove" title={`No longer part of ${g.title}`} onClick={() => setBelongsTo(page, ids.filter((id) => id !== g.id))}>
            <X size={13} />
          </button>
        </span>
      ))}
      {options.length > 0 ? (
        <select value="" onChange={(e) => e.target.value && setBelongsTo(page, [...ids, e.target.value])}>
          <option value="">{groups.length ? 'Add…' : 'Nowhere yet'}</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({p.info?.type === 'place' ? 'place' : 'faction'})
            </option>
          ))}
        </select>
      ) : (
        groups.length === 0 && <span className="muted">(make some Place or Faction pages first)</span>
      )}
    </span>
  );
}

/** Place and Faction pages: the characters that belong there. */
export function GroupMembers({ page }: { page: Page }) {
  const pages = useNotebook((s) => s.pages);
  if (!isGroup(page)) return null;
  const members = membersOf(pages, page.id);
  if (members.length === 0) return null;

  return (
    <div className="group-members">
      <span className="group-members-title muted">Characters</span>
      {members.map((m) => (
        <button key={m.id} className="page-chip page-chip-name" title="Click to peek, Ctrl+click to open" onClick={(e) => showPage(e, m.id)}>
          <PageTypeIcon type="character" size={13} />
          {m.title}
          {m.info?.type === 'character' && m.info.kind === 'pc' && <span className="muted"> · PC</span>}
        </button>
      ))}
    </div>
  );
}
