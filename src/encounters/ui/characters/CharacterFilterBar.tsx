/**
 * @file Character search bar: name search, PC/NPC filter, and a tag filter
 * button (formats included) to narrow a character list.
 */
import { Search, X } from 'lucide-react';
import { useEffect } from 'react';
import { filterableTags, type CharacterFilter } from '../../domain/characterSearch';
import { useCharacters } from '../../state/characterStore';
import { Select, type SelectOption } from 'campaign-link/ui/common/Select';
import { TagFilterButton } from './TagFilterButton';

/** Options for the PC/NPC filter dropdown. */
const KIND_OPTIONS: SelectOption<CharacterFilter['kind']>[] = [
  { value: 'all', label: 'All' },
  { value: 'npc', label: 'NPCs' },
  { value: 'pc', label: 'PCs' },
];

/** Props for CharacterFilterBar (a controlled component). */
interface Props {
  filter: CharacterFilter;
  onChange(f: CharacterFilter): void;
}

/** Name search, PC/NPC switch, tag filter button, and chips for the chosen tags. */
export function CharacterFilterBar({ filter, onChange }: Props) {
  const tags = filterableTags(useCharacters((s) => s.tags));

  // A tag deleted while selected would otherwise filter out every character.
  const stale = filter.tagIds.filter((id) => !tags.some((t) => t.id === id));
  useEffect(() => {
    if (stale.length > 0) onChange({ ...filter, tagIds: filter.tagIds.filter((id) => !stale.includes(id)) });
  }, [stale.length, filter, onChange]);

  // Add or remove a tag from the filter.
  const toggle = (id: string) =>
    onChange({
      ...filter,
      tagIds: filter.tagIds.includes(id) ? filter.tagIds.filter((x) => x !== id) : [...filter.tagIds, id],
    });

  return (
    <div className="filter-bar">
      <div className="row">
        <Search size={18} />
        <input placeholder="Search by name" value={filter.query} onChange={(e) => onChange({ ...filter, query: e.target.value })} />
        <Select
          value={filter.kind}
          options={KIND_OPTIONS}
          onChange={(kind) => onChange({ ...filter, kind })}
        />
        <TagFilterButton
          tags={tags}
          selectedIds={filter.tagIds}
          onToggle={toggle}
          onClear={() => onChange({ ...filter, tagIds: [] })}
        />
      </div>
      {filter.tagIds.length > 0 && (
        <div className="row wrap">
          {filter.tagIds.map((id) => {
            const tag = tags.find((t) => t.id === id);
            return (
              tag && (
                <span key={id} className="chip">
                  {tag.name}
                  <button type="button" className="icon" title="Stop filtering by this tag" onClick={() => toggle(id)}>
                    <X size={12} />
                  </button>
                </span>
              )
            );
          })}
        </div>
      )}
    </div>
  );
}
