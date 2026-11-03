/**
 * @file Reusable searchable multi-select dropdown with check marks, "Create …"
 * and optional delete. Used for tags and conditions.
 */
import { Check, ChevronDown, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { scrollOptionIntoView, usePopover } from 'campaign-link/ui/common/usePopover';
import 'campaign-link/ui/common/select.css';
import './searchPicker.css';

/** Anything the picker can list. */
export interface PickerItem {
  id: string;
  name: string;
  /** Shows a trash icon on the row. */
  deletable?: boolean;
}

/** Props for SearchPicker. */
interface Props<T extends PickerItem> {
  items: T[];
  selectedIds: string[];
  onToggle(item: T): void;
  onCreate(name: string): void;
  onDelete?(item: T): void;
  /** Backspace in an empty search box (e.g. remove the last chip). */
  onBackspaceEmpty?(): void;
  placeholder: string;
  emptyText: string;
  deleteTitle?(item: T): string;
}

/** A dropdown row: an existing item, or the "Create …" option. */
type Row<T> = { kind: 'create'; name: string } | { kind: 'item'; item: T };

/** Case- and whitespace-insensitive name match. */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Searchable multi-select: every item is listed with a check mark when
 * selected and clicking toggles it. Matches come first so Enter picks the best
 * one; "Create …" comes last (and is the only row when nothing matches).
 */
export function SearchPicker<T extends PickerItem>(props: Props<T>) {
  const { items, selectedIds, onToggle, onCreate, onDelete, onBackspaceEmpty, placeholder, emptyText, deleteTitle } = props;
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { anchorRef, popupRef, open, positioned, setOpen, close, style } = usePopover<HTMLDivElement>();
  const listId = useId();

  const q = query.trim();
  const matches = items
    .filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const rows: Row<T>[] = [
    ...matches.map((item) => ({ kind: 'item' as const, item })),
    ...(q && !items.some((i) => sameName(i.name, q)) ? [{ kind: 'create' as const, name: q }] : []),
  ];

  useEffect(() => setActive(0), [query, open]);
  useEffect(() => scrollOptionIntoView(popupRef.current, active), [active, popupRef, style]);

  // Toggle the item or create a new one, then clear the search.
  const choose = (row: Row<T> | undefined) => {
    if (!row) return;
    if (row.kind === 'item') onToggle(row.item);
    else onCreate(row.name);
    setQuery('');
  };

  // Arrow keys move, Enter chooses, Escape closes, Backspace on empty calls onBackspaceEmpty.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => (open ? setActive((a) => Math.min(rows.length - 1, a + 1)) : setOpen(true)),
      ArrowUp: () => setActive((a) => Math.max(0, a - 1)),
      Enter: () => (open ? choose(rows[active]) : setOpen(true)),
      Escape: () => close(),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    } else if (e.key === 'Backspace' && !query) {
      onBackspaceEmpty?.();
    }
  };

  // Shared props for an option row (index, ARIA, highlight on hover).
  const optionProps = (i: number, selected: boolean) => ({
    'data-index': i,
    role: 'option',
    'aria-selected': selected,
    className: `popup-option picker-option${i === active ? ' active' : ''}`,
    onPointerEnter: () => setActive(i),
  });

  return (
    <>
      <div ref={anchorRef} className={`picker-search${open ? ' open' : ''}`} onClick={() => setOpen(true)}>
        <Search size={16} />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="icon"
          tabIndex={-1}
          title={open ? 'Close' : 'Show all'}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {positioned &&
        createPortal(
          <div ref={popupRef} id={listId} role="listbox" aria-multiselectable className="popup-list" style={style}>
            {rows.length === 0 && <div className="popup-empty muted">{emptyText}</div>}
            {rows.map((row, i) => {
              if (row.kind === 'create') {
                return (
                  <div key="create" {...optionProps(i, false)} onClick={() => choose(row)}>
                    <Plus size={16} />
                    <span className="spacer">Create “{row.name}”</span>
                  </div>
                );
              }
              const on = selectedIds.includes(row.item.id);
              return (
                <div key={row.item.id} {...optionProps(i, on)} onClick={() => choose(row)}>
                  <span className={`picker-check${on ? ' on' : ''}`}>{on && <Check size={14} />}</span>
                  <span className="spacer">{row.item.name}</span>
                  {onDelete && row.item.deletable && (
                    <button
                      type="button"
                      className="icon picker-delete"
                      title={deleteTitle?.(row.item) ?? `Delete "${row.item.name}"`}
                      onClick={(e) => {
                        e.stopPropagation();
                        close();
                        onDelete(row.item);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
