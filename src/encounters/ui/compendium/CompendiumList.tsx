/**
 * @file A format's compendium creatures: search by name, CR range and type;
 * open a row to see its stat block; the row's button does `action` (add to
 * the encounter, copy to the library). The source's licence notice sits
 * underneath.
 */
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { CHALLENGE_RATINGS } from 'campaign-link/formats/dnd5e/proficiency';
import { Select, type SelectOption } from 'campaign-link/ui/common/Select';
import { useState, type ReactNode } from 'react';
import { crValue, EMPTY_COMPENDIUM_FILTER, entryTypes, filterEntries } from '../../domain/compendium/fromCompendium';
import type { CompendiumEntry } from '../../domain/compendium/types';
import { useCompendium } from '../../state/compendium';
import { StatBlockView } from '../formats/StatBlockView';
import './compendium.css';

/** Rows drawn at once; the search narrows the rest. */
const SHOWN_LIMIT = 150;

const crOptions = (none: string): SelectOption<string>[] => [{ value: '', label: none }, ...CHALLENGE_RATINGS.map((cr) => ({ value: cr, label: `CR ${cr}` }))];
const MIN_OPTIONS = crOptions('Any CR from');
const MAX_OPTIONS = crOptions('to any');

interface Props {
  formatId: FormatId;
  /** The button on each row, for that creature (null: no button). */
  action(entry: CompendiumEntry): ReactNode;
}

function Row({ entry, formatId, action }: { entry: CompendiumEntry; formatId: FormatId; action: Props['action'] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="compendium-row">
      <div className="character-item">
        <button className="icon" title={open ? 'Hide stat block' : 'Show stat block'} onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <span className="name">{entry.name}</span>
        <span className="muted compendium-type">{entry.type}</span>
        <span className="chip">CR {entry.cr}</span>
        {action(entry)}
      </div>
      {open && (
        <div className="compendium-statblock">
          <StatBlockView template={{ id: entry.id, name: entry.name, kind: 'npc', formatId, tagIds: [], deathSaves: false, statBlock: entry.statBlock }} />
        </div>
      )}
    </div>
  );
}

export function CompendiumList({ formatId, action }: Props) {
  const compendium = useCompendium(formatId);
  const [filter, setFilter] = useState(EMPTY_COMPENDIUM_FILTER);
  const [noticeOpen, setNoticeOpen] = useState(false);

  if (compendium === null) return <p className="muted">Loading creatures…</p>;
  if ('error' in compendium) return <p className="empty-state">{compendium.error}</p>;

  const shown = filterEntries(compendium.entries, filter);
  const typeOptions: SelectOption<string>[] = [{ value: '', label: 'Every type' }, ...entryTypes(compendium.entries).map((t) => ({ value: t, label: t }))];
  const cr = (value: string) => (value ? crValue(value) : null);

  return (
    <div className="compendium">
      <div className="filter-bar">
        <div className="row wrap">
          <Search size={18} />
          <input placeholder="Search by name" value={filter.query} onChange={(e) => setFilter({ ...filter, query: e.target.value })} />
          <Select value={filter.type} options={typeOptions} onChange={(type) => setFilter({ ...filter, type })} />
          <Select
            value={filter.minCr === null ? '' : (CHALLENGE_RATINGS.find((c) => crValue(c) === filter.minCr) ?? '')}
            options={MIN_OPTIONS}
            onChange={(v) => setFilter({ ...filter, minCr: cr(v) })}
          />
          <Select
            value={filter.maxCr === null ? '' : (CHALLENGE_RATINGS.find((c) => crValue(c) === filter.maxCr) ?? '')}
            options={MAX_OPTIONS}
            onChange={(v) => setFilter({ ...filter, maxCr: cr(v) })}
          />
        </div>
      </div>
      <div className="character-list">
        {shown.length === 0 && <p className="empty-state">No creatures match.</p>}
        {shown.slice(0, SHOWN_LIMIT).map((e) => (
          <Row key={e.id} entry={e} formatId={formatId} action={action} />
        ))}
        {shown.length > SHOWN_LIMIT && <p className="muted">{shown.length - SHOWN_LIMIT} more: narrow the search to see them.</p>}
      </div>
      <div className="compendium-notice muted">
        <button className="compendium-notice-toggle" onClick={() => setNoticeOpen(!noticeOpen)}>
          Creatures from the {compendium.source} (open content) · {noticeOpen ? 'hide' : 'licence'}
        </button>
        {noticeOpen && <p>{compendium.attribution}</p>}
      </div>
    </div>
  );
}
