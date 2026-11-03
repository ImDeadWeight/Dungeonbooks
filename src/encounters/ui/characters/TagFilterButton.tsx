/**
 * @file Compact tag filter: a button that opens a searchable check-mark list
 * of tags (formats included), in the same style as the tag picker.
 */
import { Check, ListFilter, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Tag } from '../../domain/characters';
import { scrollOptionIntoView, usePopover } from 'campaign-link/ui/common/usePopover';
import 'campaign-link/ui/common/select.css';
import '../common/searchPicker.css';

/** Props for TagFilterButton (a controlled component). */
interface Props {
  tags: Tag[];
  selectedIds: string[];
  onToggle(id: string): void;
  onClear(): void;
}

/** "Tags" button with a count badge; its popup searches and toggles tags. */
export function TagFilterButton({ tags, selectedIds, onToggle, onClear }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { anchorRef, popupRef, open, positioned, setOpen, close, style } = usePopover<HTMLButtonElement>('end');
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = query.trim().toLowerCase();
  const matches = tags.filter((t) => t.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => setActive(0), [query, open]);
  useEffect(() => scrollOptionIntoView(listRef.current, active), [active, style]);
  // Start each visit with an empty search and the cursor in it.
  useEffect(() => {
    if (positioned) searchRef.current?.focus();
    else setQuery('');
  }, [positioned]);

  // Close and hand focus back to the button.
  const dismiss = () => {
    close();
    anchorRef.current?.focus();
  };

  // Arrow keys move, Enter toggles, Escape closes.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((a) => Math.min(matches.length - 1, a + 1)),
      ArrowUp: () => setActive((a) => Math.max(0, a - 1)),
      Enter: () => matches[active] && onToggle(matches[active].id),
      Escape: dismiss,
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  };

  const count = selectedIds.length;
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={`tag-filter-button${count > 0 ? ' on' : ''}`}
        title="Filter by tag"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <ListFilter size={16} /> Tags
        {count > 0 && <span className="tag-filter-count">{count}</span>}
      </button>
      {positioned &&
        createPortal(
          <div ref={popupRef} className="popup-list tag-filter-popup" style={style}>
            <div className="picker-search">
              <Search size={16} />
              <input
                ref={searchRef}
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                placeholder="Search tags"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
            <div ref={listRef} id={listId} role="listbox" aria-multiselectable className="tag-filter-list">
              {matches.length === 0 && <div className="popup-empty muted">No tags match.</div>}
              {matches.map((t, i) => {
                const on = selectedIds.includes(t.id);
                return (
                  <div
                    key={t.id}
                    data-index={i}
                    role="option"
                    aria-selected={on}
                    className={`popup-option picker-option${i === active ? ' active' : ''}`}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => onToggle(t.id)}
                  >
                    <span className={`picker-check${on ? ' on' : ''}`}>{on && <Check size={14} />}</span>
                    <span className="spacer">{t.name}</span>
                  </div>
                );
              })}
            </div>
            {count > 0 && (
              <button type="button" className="tag-filter-clear" onClick={onClear}>
                Clear {count} selected
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
