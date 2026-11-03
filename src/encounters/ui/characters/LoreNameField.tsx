/**
 * @file Naming a character from Lorekeeper: while typing a name, Character
 * pages from linked notebooks that match appear under the field; picking one
 * fills in the name and PC/NPC and remembers the page. The chip below the
 * form shows which page a character came from, opens it, or forgets it, and
 * offers the page's stat block when it differs from the character's.
 */
import { sameStatBlock, type LorePage, type LorekeeperCatalog, type SharedStatBlock } from 'campaign-link';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { getFormat } from 'campaign-link/formats/registry';
import { BookOpen, ScrollText, X } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { LoreRef } from '../../domain/characters';
import type { Id } from '../../domain/ids';
import { suggestLoreCharacters as matching, type LoreCharacter } from '../../domain/loreSuggestions';
import { openInLorekeeper } from '../../state/appLinks';
import { useCatalogs } from '../../../bridge/catalogs';
import { useCharacters } from '../../state/characterStore';
import { scrollOptionIntoView, usePopover } from 'campaign-link/ui/common/usePopover';

/** Every Character page in the notebooks linked to campaigns. */
function useLoreCharacters(): LoreCharacter[] {
  const catalogs = useCatalogs((s) => s.lore);
  return useMemo(() => {
    const seen = new Set<Id>();
    const result: LoreCharacter[] = [];
    for (const catalog of Object.values(catalogs)) {
      // Two campaigns can't share a notebook, but stay safe if a stale catalogue lingers.
      if (seen.has(catalog.notebookId)) continue;
      seen.add(catalog.notebookId);
      for (const page of catalog.pages) {
        if (page.info.type !== 'character') continue;
        result.push({ notebookId: catalog.notebookId, pageId: page.id, title: page.title, kind: page.info.kind, notebookName: catalog.name });
      }
    }
    return result;
  }, [catalogs]);
}

/** Props for LoreNameField. */
interface FieldProps {
  name: string;
  /** The page the character currently comes from (that page isn't suggested again). */
  lore: LoreRef | null;
  /** The character being edited, so it doesn't count as "already a character". */
  templateId: Id;
  onName(name: string): void;
  onPick(c: LoreCharacter): void;
}

/** The Name field, with Lorekeeper suggestions under it while typing. */
export function LoreNameField({ name, lore, templateId, onName, onPick }: FieldProps) {
  const characters = useLoreCharacters();
  const templates = useCharacters((s) => s.templates);
  const [active, setActive] = useState(0);
  const { anchorRef, popupRef, positioned, setOpen, close, style } = usePopover<HTMLLabelElement>();
  const suggestions = matching(characters, name).filter((c) => !(lore && c.pageId === lore.pageId && c.notebookId === lore.notebookId));
  const severalNotebooks = new Set(characters.map((c) => c.notebookId)).size > 1;
  /** Pages another character already came from. */
  const usedPages = new Set(templates.filter((t) => t.id !== templateId && t.lore).map((t) => `${t.lore!.notebookId}/${t.lore!.pageId}`));

  const pick = (c: LoreCharacter) => {
    onPick(c);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!positioned || suggestions.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
      setActive(next);
      scrollOptionIntoView(popupRef.current, next);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(suggestions[Math.min(active, suggestions.length - 1)]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };

  return (
    <label ref={anchorRef} className="field grow">
      Name
      <input
        autoFocus
        value={name}
        role="combobox"
        aria-expanded={positioned}
        aria-autocomplete="list"
        onChange={(e) => {
          onName(e.target.value);
          setActive(0);
          setOpen(matching(characters, e.target.value).length > 0);
        }}
        onKeyDown={onKeyDown}
      />
      {positioned &&
        suggestions.length > 0 &&
        createPortal(
          <div ref={popupRef} role="listbox" className="popup-list lore-suggestions" style={style}>
            <div className="lore-suggestions-title muted">From Lorekeeper</div>
            {suggestions.map((c, i) => (
              <div
                key={`${c.notebookId}/${c.pageId}`}
                role="option"
                aria-selected={i === active}
                data-index={i}
                className={`popup-option lore-suggestion${i === active ? ' active' : ''}`}
                onMouseEnter={() => setActive(i)}
                // Keep focus in the name field.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
              >
                <span className="spacer">{c.title}</span>
                {usedPages.has(`${c.notebookId}/${c.pageId}`) && <span className="muted">already a character</span>}
                {severalNotebooks && <span className="muted">{c.notebookName}</span>}
                <span className="chip">{c.kind === 'pc' ? 'PC' : 'NPC'}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </label>
  );
}

/** Which Lorekeeper page a character came from, with Open and Forget. Nothing when it didn't come from one. */
export function LoreSourceChip({ lore, onForget }: { lore: LoreRef | null; onForget(): void }) {
  const title = useCatalogs((s) => findLorePage(s.lore, lore)?.title ?? null);
  if (!lore) return null;
  return (
    <div className="lore-source row">
      <BookOpen size={15} />
      <span className="spacer">
        From Lorekeeper: <strong>{title ?? 'a page in a notebook not linked here'}</strong>
      </span>
      <button type="button" onClick={() => openInLorekeeper(lore)}>
        Open in Lorekeeper
      </button>
      <button type="button" className="icon" title="Forget which page this came from" onClick={onForget}>
        <X size={15} />
      </button>
    </div>
  );
}

/** The page a character came from, as its linked notebook publishes it; null when that notebook isn't linked here. */
function findLorePage(catalogs: Record<Id, LorekeeperCatalog>, lore: LoreRef | null): LorePage | null {
  if (!lore) return null;
  const catalog = Object.values(catalogs).find((c) => c.notebookId === lore.notebookId);
  return catalog?.pages.find((p) => p.id === lore.pageId) ?? null;
}

/** Props for LoreStatBlockOffer. */
interface OfferProps {
  lore: LoreRef | null;
  /** The character's stat block as the form has it; null when it has none. */
  current: SharedStatBlock | null;
  /** Set when the character's format can't change (it's in an encounter). */
  lockedFormatId: FormatId | null;
  onTake(statBlock: SharedStatBlock): void;
}

/** When the Lorekeeper page has a stat block other than the character's, offers to use it instead. */
export function LoreStatBlockOffer({ lore, current, lockedFormatId, onTake }: OfferProps) {
  const offered = useCatalogs((s) => findLorePage(s.lore, lore)?.statBlock);
  if (!offered || sameStatBlock(offered, current)) return null;
  const blocked = lockedFormatId !== null && lockedFormatId !== offered.formatId;
  return (
    <div className="lore-source row">
      <ScrollText size={15} />
      <span className="spacer">
        {current ? 'The Lorekeeper page has a different stat block' : 'The Lorekeeper page has a stat block'} ({getFormat(offered.formatId).name}).
      </span>
      <button
        type="button"
        disabled={blocked}
        title={
          blocked
            ? `It's for ${getFormat(offered.formatId).name}, and this character is in an encounter, so its format can't change`
            : "Replace this character's stat block with the page's (Save character to keep it)"
        }
        onClick={() => onTake(offered)}
      >
        Use Lorekeeper's
      </button>
    </div>
  );
}
