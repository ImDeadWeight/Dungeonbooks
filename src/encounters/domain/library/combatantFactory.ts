/**
 * @file Turns character templates into encounter combatants: starting HP
 * (rolled per copy from hit dice), numbering of copies ("Goblin 1, 2, 3"),
 * and the rules that a PC can only be in an encounter once and every
 * character must use the encounter's format.
 */
import type { CharacterTemplate } from '../characters';
import { noDyingProgress, type Combatant } from '../combat/types';
import { rollFormula } from 'campaign-link/formats/dice';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { getFormat } from 'campaign-link/formats/registry';
import { newId } from '../ids';

/** One line of the encounter builder's cart: which character, and how many copies. */
export interface CartLine {
  templateId: string;
  quantity: number;
}

/** Each copy rolls its own HP when the stat block has hit dice; otherwise uses the fixed value. */
function startingHp(t: CharacterTemplate): number | null {
  if (!t.statBlock) return null;
  const format = getFormat(t.formatId);
  const dice = format.hitDice(t.statBlock);
  return dice ? rollFormula(dice) : format.maxHp(t.statBlock);
}

/** A fresh combatant for a template: full HP, no initiative, no conditions, active. */
function makeCombatant(t: CharacterTemplate, name: string, addedOrder: number): Combatant {
  const hp = startingHp(t);
  return {
    id: newId(),
    templateId: t.id,
    name,
    maxHp: hp,
    currentHp: hp,
    tempHp: 0,
    initiative: null,
    addedOrder,
    tokenDescription: '',
    side: '',
    conditions: [],
    status: 'active',
    dying: noDyingProgress(),
    dyingRollMadeThisTurn: false,
  };
}

/**
 * Adds cart lines to an existing combatant list. When a template appears more
 * than once in the encounter, copies are numbered ("Goblin 1", "Goblin 2"),
 * and a lone unnumbered earlier copy is renamed to "… 1". PCs are added once.
 * Characters of another format than the encounter's are skipped.
 */
export function addToCombatants(
  existing: Combatant[],
  lines: CartLine[],
  lookup: (id: string) => CharacterTemplate | undefined,
  formatId: FormatId,
): Combatant[] {
  let result = [...existing];
  let order = existing.reduce((max, c) => Math.max(max, c.addedOrder), -1) + 1;

  for (const line of lines) {
    const t = lookup(line.templateId);
    if (!t || t.formatId !== formatId) continue;
    const already = result.filter((c) => c.templateId === t.id);
    if (t.kind === 'pc') {
      if (already.length === 0) result.push(makeCombatant(t, t.name, order++));
      continue;
    }
    const quantity = Math.max(1, Math.floor(line.quantity));
    const total = already.length + quantity;
    if (total > 1) {
      result = result.map((c) => (c.templateId === t.id && c.name === t.name ? { ...c, name: `${t.name} 1` } : c));
    }
    for (let i = 0; i < quantity; i++) {
      const name = total > 1 ? `${t.name} ${already.length + i + 1}` : t.name;
      result.push(makeCombatant(t, name, order++));
    }
  }
  return result;
}
