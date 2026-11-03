/**
 * @file The row under a page's title: what the page describes (note,
 * character, place…) and that type's own fields — PC/NPC for characters,
 * the place a place is inside — plus the Stat block (characters) and Link
 * encounter buttons — and the other names the page goes by.
 */
import { useEffect, useState } from 'react';
import { useNotebook } from '../../state/notebookStore';
import {
  infoForType,
  PAGE_TYPES,
  pageType,
  parseAliases,
  parentPlace,
  placeParentOptions,
  type CharacterKind,
  type Page,
  type PageType,
} from '../../domain/notebook';
import { LinkEncounterButton } from '../encounters/LinkEncounterDialog';
import { PageTypeIcon } from './pageTypes';
import { StatBlockButton } from './StatBlockPanel';

/** The page's aliases as a comma-separated list, saved when the field is left (or on Enter). */
function AliasesField({ page }: { page: Page }) {
  const saved = (page.aliases ?? []).join(', ');
  const [value, setValue] = useState(saved);
  // Follow changes made elsewhere, and start over on another page.
  useEffect(() => setValue(saved), [saved]);

  const commit = () => {
    const aliases = parseAliases(value);
    setValue(aliases.join(', '));
    if (aliases.join(', ') !== saved) useNotebook.getState().setPageAliases(page.id, aliases);
  };

  return (
    <label className="page-info-field" title="Other names for this page, separated by commas. Mentions of them link here too.">
      <span className="muted">Also called</span>
      <input
        className="page-aliases"
        value={value}
        placeholder="other names, comma-separated"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  );
}

/** Type picker plus the chosen type's fields. */
export function PageInfoBar({ page }: { page: Page }) {
  const pages = useNotebook((s) => s.pages);
  const type = pageType(page);
  const setInfo = (info: Page['info']) => useNotebook.getState().setPageInfo([page.id], () => info);

  return (
    <div className="page-info-bar">
      <label className="page-info-field" title="What this page describes">
        <PageTypeIcon type={type} />
        <select value={type} onChange={(e) => setInfo(infoForType(e.target.value as PageType, page.info))}>
          {PAGE_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {page.info?.type === 'character' && (
        <label className="page-info-field">
          <select value={page.info.kind} onChange={(e) => setInfo({ type: 'character', kind: e.target.value as CharacterKind })}>
            <option value="npc">NPC</option>
            <option value="pc">Player character</option>
          </select>
        </label>
      )}

      {page.info?.type === 'place' && (
        <label className="page-info-field">
          <span className="muted">Inside</span>
          <select
            value={parentPlace(pages, page)?.id ?? ''}
            onChange={(e) => setInfo({ type: 'place', parentPlaceId: e.target.value || null })}
          >
            <option value="">Nowhere (top level)</option>
            {placeParentOptions(pages, page.id).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <AliasesField key={page.id} page={page} />

      <span className="spacer" />
      {page.info?.type === 'character' && <StatBlockButton />}
      <LinkEncounterButton pageId={page.id} />
    </div>
  );
}
