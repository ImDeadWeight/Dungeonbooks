/**
 * @file State hook for the encounter-builder cart.
 */
import { useState } from 'react';
import type { CharacterTemplate } from '../../domain/characters';
import type { CartLine } from '../../domain/library/combatantFactory';

/** Cart state for building an encounter. PCs are capped at one each. */
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = (t: CharacterTemplate, quantity: number) =>
    setLines((ls) => {
      const existing = ls.find((l) => l.templateId === t.id);
      if (!existing) return [...ls, { templateId: t.id, quantity: t.kind === 'pc' ? 1 : quantity }];
      if (t.kind === 'pc') return ls;
      return ls.map((l) => (l.templateId === t.id ? { ...l, quantity: l.quantity + quantity } : l));
    });

  const setQuantity = (templateId: string, quantity: number) =>
    setLines((ls) => ls.map((l) => (l.templateId === templateId ? { ...l, quantity: Math.max(1, quantity) } : l)));

  const remove = (templateId: string) => setLines((ls) => ls.filter((l) => l.templateId !== templateId));

  const clear = () => setLines([]);

  return { lines, add, setQuantity, remove, clear };
}

/** The cart hook's return value, passed to CartBuilder. */
export type Cart = ReturnType<typeof useCart>;
