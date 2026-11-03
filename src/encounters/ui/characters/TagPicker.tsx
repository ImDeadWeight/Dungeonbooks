/**
 * @file Tag selection for a character: chips for its tags plus a searchable
 * picker over the shared tag library (create, toggle, delete).
 */
import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { Id } from '../../domain/ids';
import { useCharacters } from '../../state/characterStore';
import { confirmThen } from '../common/ConfirmDialog';
import { SearchPicker } from '../common/SearchPicker';

/** Props for TagPicker. */
interface Props {
  tagIds: Id[];
  /** Read-only tag shown first (the format). */
  lockedLabel?: string;
  onChange(tagIds: Id[]): void;
}

/** Chips for this character's tags plus a search picker over the shared tag library. */
export function TagPicker({ tagIds, lockedLabel, onChange }: Props) {
  const tags = useCharacters((s) => s.tags);
  const templates = useCharacters((s) => s.templates);

  // A tag deleted from the library drops off this character too.
  useEffect(() => {
    const known = tagIds.filter((id) => tags.some((t) => t.id === id));
    if (known.length !== tagIds.length) onChange(known);
  }, [tags, tagIds, onChange]);

  // Add the tag if missing, remove it if present.
  const toggle = (id: Id) => onChange(tagIds.includes(id) ? tagIds.filter((x) => x !== id) : [...tagIds, id]);

  // Create (or reuse by name) a library tag and add it to this character.
  const create = (name: string) => {
    const tag = useCharacters.getState().ensureTag(name);
    if (!tagIds.includes(tag.id)) onChange([...tagIds, tag.id]);
  };

  // Delete a tag from the whole library after confirming (shows how many characters use it).
  const remove = (id: Id, name: string) => {
    const used = templates.filter((t) => t.tagIds.includes(id)).length;
    const usage = used > 0 ? ` It will be removed from ${used} character${used === 1 ? '' : 's'}.` : '';
    confirmThen(`Delete the tag "${name}"?${usage}`, 'Delete tag', () => useCharacters.getState().deleteTag(id));
  };

  return (
    <div className="tag-picker">
      <div className="row wrap">
        {lockedLabel && <span className="chip locked" title="Format tag">{lockedLabel}</span>}
        {tagIds.map((id) => {
          const tag = tags.find((t) => t.id === id);
          return (
            tag && (
              <span key={id} className="chip">
                {tag.name}
                <button type="button" className="icon" title="Remove from this character" onClick={() => toggle(id)}>
                  <X size={12} />
                </button>
              </span>
            )
          );
        })}
      </div>
      <SearchPicker
        items={tags.map((t) => ({ ...t, deletable: true }))}
        selectedIds={tagIds}
        onToggle={(t) => toggle(t.id)}
        onCreate={create}
        onDelete={(t) => remove(t.id, t.name)}
        onBackspaceEmpty={() => tagIds.length > 0 && onChange(tagIds.slice(0, -1))}
        placeholder="Search or create tags"
        emptyText="No tags yet. Type a name to create one."
        deleteTitle={(t) => `Delete "${t.name}" from all characters`}
      />
    </div>
  );
}
