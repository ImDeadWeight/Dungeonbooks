/**
 * @file Character store: character templates, the shared tag library, and
 * custom conditions, with actions to create, edit and delete them. Saved to
 * characters.json and conditions.json by persistence.ts.
 */
import { create } from 'zustand';
import type { CharacterTemplate, Tag } from '../domain/characters';
import type { ConditionDef, CustomCondition } from '../domain/conditions';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { getFormat } from 'campaign-link/formats/registry';
import { newId, type Id } from '../domain/ids';

/** Character data plus its actions. */
interface CharacterState {
  templates: CharacterTemplate[];
  tags: Tag[];
  customConditions: CustomCondition[];
  /** Replaces everything (used on load and after an import). */
  replaceAll(data: { templates: CharacterTemplate[]; tags: Tag[]; customConditions: CustomCondition[] }): void;
  /** Adds a new template or updates an existing one (matched by id). */
  saveTemplate(t: CharacterTemplate): void;
  /** Deletes a template. Callers check first that no encounter uses it. */
  deleteTemplate(id: Id): void;
  /** Returns the existing tag when the name matches case-insensitively. */
  ensureTag(name: string): Tag;
  /** Removes the tag from the library and from every character that has it. */
  deleteTag(id: Id): void;
  /** Returns the existing condition (built-in or custom) when the name matches. */
  ensureCustomCondition(
    formatId: FormatId,
    name: string,
    details?: Partial<Pick<ConditionDef, 'effect' | 'endsWhen' | 'repeatsSave' | 'valued' | 'dropsEachTurn'>>,
  ): ConditionDef;
  /** Adds a new custom condition or updates an existing one (matched by id). */
  saveCustomCondition(c: CustomCondition): void;
  /** Removes a custom condition from the picker; conditions already on combatants keep their name. */
  deleteCustomCondition(id: Id): void;
}

/** Case- and whitespace-insensitive name match. */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The character store hook. */
export const useCharacters = create<CharacterState>((set, get) => ({
  templates: [],
  tags: [],
  customConditions: [],
  replaceAll: (data) => set(data),
  saveTemplate: (t) =>
    set((s) => ({
      templates: s.templates.some((x) => x.id === t.id)
        ? s.templates.map((x) => (x.id === t.id ? t : x))
        : [...s.templates, t],
    })),
  deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
  ensureTag(name) {
    const found = get().tags.find((t) => sameName(t.name, name));
    if (found) return found;
    const tag = { id: newId(), name: name.trim() };
    set((s) => ({ tags: [...s.tags, tag] }));
    return tag;
  },
  deleteTag: (id) =>
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== id),
      templates: s.templates.map((t) => (t.tagIds.includes(id) ? { ...t, tagIds: t.tagIds.filter((x) => x !== id) } : t)),
    })),
  ensureCustomCondition(formatId, name, details = {}) {
    const found = conditionsFor(formatId, get().customConditions).find((c) => sameName(c.name, name));
    if (found) return found;
    const cond: CustomCondition = {
      id: newId(),
      name: name.trim(),
      formatId,
      effect: details.effect?.trim() ?? '',
      endsWhen: details.endsWhen?.trim() ?? '',
      repeatsSave: details.repeatsSave ?? false,
      ...(getFormat(formatId).valuedConditions && {
        valued: !!details.valued,
        dropsEachTurn: !!(details.valued && details.dropsEachTurn),
      }),
    };
    set((s) => ({ customConditions: [...s.customConditions, cond] }));
    return cond;
  },
  saveCustomCondition: (c) =>
    set((s) => ({
      customConditions: s.customConditions.some((x) => x.id === c.id)
        ? s.customConditions.map((x) => (x.id === c.id ? c : x))
        : [...s.customConditions, c],
    })),
  deleteCustomCondition: (id) => set((s) => ({ customConditions: s.customConditions.filter((c) => c.id !== id) })),
}));

/** True if another condition of the format (built-in or custom, other than `exceptId`) already has this name. */
export function conditionNameTaken(formatId: FormatId, name: string, custom: CustomCondition[], exceptId?: Id): boolean {
  return conditionsFor(formatId, custom).some((c) => c.id !== exceptId && sameName(c.name, name));
}

/** All conditions available for a format: its built-ins followed by the user's custom ones. */
export function conditionsFor(formatId: FormatId, custom: CustomCondition[]): ConditionDef[] {
  return [...getFormat(formatId).conditions, ...custom.filter((c) => c.formatId === formatId)];
}

/** React hook: a function that finds a template by id (re-renders when templates change). */
export function useTemplateLookup() {
  const templates = useCharacters((s) => s.templates);
  return (id: Id) => templates.find((t) => t.id === id);
}
