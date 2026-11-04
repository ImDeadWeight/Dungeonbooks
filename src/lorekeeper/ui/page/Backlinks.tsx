/**
 * @file A page's backlinks under its title: the pages linking to it, and the
 * pages naming it without a link yet (each with a Link button). Folded to
 * one line until opened; names peek on click, Ctrl+click opens them.
 */
import { ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import type { Backlink } from '../../domain/backlinks';
import { linkMentionsOf } from '../../domain/backlinks';
import type { Id } from '../../domain/ids';
import { linkCandidates } from '../../domain/linkCandidates';
import { pageType, type Page } from '../../domain/notebook';
import { createTitleMatcher } from '../../domain/titleMatcher';
import { backlinksOf } from '../../state/backlinkIndex';
import { useNotebook } from '../../state/notebookStore';
import { PageTypeIcon } from './pageTypes';
import { showPage } from './showPage';
import './backlinks.css';

/** Links every unlinked mention of `targetId` on `source`. */
function linkMentionsOn(source: Page, targetId: Id) {
  const store = useNotebook.getState();
  const matcher = createTitleMatcher(linkCandidates(store.pages, source.id));
  for (const { boxId, content } of linkMentionsOf(source, matcher, targetId)) store.replaceBoxContent(source.id, boxId, content);
}

const pagesWord = (n: number) => `${n} page${n === 1 ? '' : 's'}`;

function BacklinkRow({ backlink, onLink }: { backlink: Backlink; onLink?: () => void }) {
  const { page, snippet, count } = backlink;
  return (
    <li className="backlink">
      <button className="page-chip page-chip-name" title="Click to peek, Ctrl+click to open" onClick={(e) => showPage(e, page.id)}>
        <PageTypeIcon type={pageType(page)} size={13} />
        {page.title}
        {count > 1 && <span className="muted"> ×{count}</span>}
      </button>
      <span className="backlink-snippet muted">{snippet}</span>
      {onLink && (
        <button className="icon" title={count > 1 ? `Link all ${count} mentions` : 'Link this mention'} onClick={onLink}>
          <Link2 size={14} />
        </button>
      )}
    </li>
  );
}

/** "Linked from" and "Mentioned in" for the open page; nothing when no other page points at it. */
export function Backlinks({ page }: { page: Page }) {
  // Deferred, so typing on the page isn't held up by working out the lists.
  const pages = useDeferredValue(useNotebook((s) => s.pages));
  const [open, setOpen] = useState(false);
  const { linkedFrom, mentionedIn } = backlinksOf(pages, page.id);
  if (!linkedFrom.length && !mentionedIn.length) return null;

  const summary = [
    linkedFrom.length && `Linked from ${pagesWord(linkedFrom.length)}`,
    mentionedIn.length && `mentioned in ${pagesWord(mentionedIn.length)}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="backlinks">
      <button className="backlinks-toggle muted" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {summary.charAt(0).toUpperCase() + summary.slice(1)}
      </button>
      {open && (
        <>
          {linkedFrom.length > 0 && (
            <section>
              <h4 className="backlinks-title muted">Linked from</h4>
              <ul>
                {linkedFrom.map((b) => (
                  <BacklinkRow key={b.page.id} backlink={b} />
                ))}
              </ul>
            </section>
          )}
          {mentionedIn.length > 0 && (
            <section>
              <h4 className="backlinks-title muted">Mentioned in (not linked)</h4>
              <ul>
                {mentionedIn.map((b) => (
                  <BacklinkRow key={b.page.id} backlink={b} onLink={() => linkMentionsOn(b.page, page.id)} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** The peek panel's short version: just who links here. */
export function PeekBacklinks({ pageId }: { pageId: Id }) {
  const pages = useNotebook((s) => s.pages);
  const { linkedFrom } = backlinksOf(pages, pageId);
  if (!linkedFrom.length) return null;
  return (
    <div className="peek-backlinks">
      <span className="muted">Linked from</span>
      {linkedFrom.map((b) => (
        <button key={b.page.id} className="page-chip page-chip-name" title="Click to peek, Ctrl+click to open" onClick={(e) => showPage(e, b.page.id)}>
          {b.page.title}
        </button>
      ))}
    </div>
  );
}
