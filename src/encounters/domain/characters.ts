/**
 * @file Character model: reusable character templates (PCs and NPCs), their
 * tags, and the stat block union across game formats. Encounters link to
 * templates by id rather than copying them.
 */
import type { Id } from './ids';
import type { FormatId } from 'campaign-link/formats/formatIds';
import type { CharacterKind, StatBlock } from 'campaign-link/formats/types';

// Character kinds and the stat block union are shared with Lorekeeper (campaign-link).
export type { CharacterKind, StatBlock };

/** A user-created label for filtering characters (e.g. "Undead", "Goblinoid"). Shared library-wide. */
export interface Tag {
  id: Id;
  name: string;
}

/** A reusable character/creature definition. Encounters reference it by id. */
export interface CharacterTemplate {
  id: Id;
  name: string;
  kind: CharacterKind;
  /** Game system; decides the stat block shape and rules. Also acts as a filter tag. */
  formatId: FormatId;
  tagIds: Id[];
  /**
   * Follows the format's dying rules at 0 HP (death saves, Dying, negative
   * HP) instead of dying outright. Always true for PCs; opt-in for NPCs.
   */
  deathSaves: boolean;
  /** null when the stat block was skipped. */
  statBlock: StatBlock | null;
  /** The Lorekeeper page this character came from; absent when it didn't come from one. */
  lore?: LoreRef;
}

/** A page in a Lorekeeper notebook (see the campaign-link package). */
export interface LoreRef {
  notebookId: Id;
  pageId: Id;
}

/** Whether a character follows the dying rules at 0 HP: always for PCs, opt-in for NPCs. */
export function usesDeathSaves(t: Pick<CharacterTemplate, 'kind' | 'deathSaves'>): boolean {
  return t.kind === 'pc' || t.deathSaves;
}
