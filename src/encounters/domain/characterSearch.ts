/**
 * @file Character search and filtering by name, PC/NPC kind, and tags. Used
 * by the character library and the encounter builder. Formats behave as
 * extra tags ("5e") here without being stored on templates.
 */
import type { CharacterKind, CharacterTemplate, Tag } from './characters';
import { formatTagId } from 'campaign-link/formats/formatIds';
import { FORMAT_LIST } from 'campaign-link/formats/registry';

/** The current search: name text, required tags, and which kind of character to show. */
export interface CharacterFilter {
  query: string;
  /** User tag ids and/or format tag ids ("format:dnd5e"); all must match. */
  tagIds: string[];
  kind: CharacterKind | 'all';
}

/** A filter that matches every character. */
export const EMPTY_FILTER: CharacterFilter = { query: '', tagIds: [], kind: 'all' };

/** Formats behave as tags for filtering, without being stored on the template. */
export function filterableTags(userTags: Tag[]): Tag[] {
  return [...FORMAT_LIST.map((f) => ({ id: formatTagId(f.id), name: f.name })), ...userTags];
}

/** All tag ids a template matches: its format tag plus its user tags. */
export function templateTagIds(t: CharacterTemplate): string[] {
  return [formatTagId(t.formatId), ...t.tagIds];
}

/** Templates matching the filter (kind, name contains query, has every chosen tag), sorted by name. */
export function filterTemplates(templates: CharacterTemplate[], f: CharacterFilter): CharacterTemplate[] {
  const q = f.query.trim().toLowerCase();
  return templates
    .filter((t) => f.kind === 'all' || t.kind === f.kind)
    .filter((t) => !q || t.name.toLowerCase().includes(q))
    .filter((t) => {
      const ids = templateTagIds(t);
      return f.tagIds.every((id) => ids.includes(id));
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
