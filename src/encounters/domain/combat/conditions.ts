/**
 * @file Condition actions during an encounter: apply, resolve for this turn,
 * toggle the per-turn save, change a condition's value, and remove.
 */
import { MAX_CONDITION_VALUE, type ConditionDef } from '../conditions';
import { newId, type Id } from '../ids';
import type { Encounter } from '../library/types';
import type { Combatant } from './types';
import { updateCombatant } from './update';

/**
 * Whether the instance needs a per-turn roll defaults from the definition.
 * A condition added during the combatant's own turn counts as already
 * acknowledged for that turn; it has to be resolved from their next turn on.
 * Valued conditions start at 1.
 */
export function addCondition(enc: Encounter, id: Id, def: ConditionDef, requiresResolve = def.repeatsSave): Encounter {
  const resolvedThisTurn = enc.combat.currentId === id;
  return updateCombatant(enc, id, (c) => ({
    ...c,
    conditions: [
      ...c.conditions,
      {
        instanceId: newId(),
        conditionId: def.id,
        name: def.name,
        value: def.valued ? 1 : null,
        dropsEachTurn: !!(def.valued && def.dropsEachTurn),
        requiresResolve,
        resolvedThisTurn,
      },
    ],
  }));
}

/** Marks one applied condition as resolved (rolled for) this turn. */
export function resolveCondition(enc: Encounter, id: Id, instanceId: Id): Encounter {
  return updateCombatant(enc, id, (c) => ({
    ...c,
    conditions: c.conditions.map((x) => (x.instanceId === instanceId ? { ...x, resolvedThisTurn: true } : x)),
  }));
}

/** Per-instance override: the effect that applied it decides whether a save repeats each turn. */
export function setRequiresResolve(enc: Encounter, id: Id, instanceId: Id, requiresResolve: boolean): Encounter {
  return updateCombatant(enc, id, (c) => ({
    ...c,
    conditions: c.conditions.map((x) => (x.instanceId === instanceId ? { ...x, requiresResolve } : x)),
  }));
}

/** Sets a valued condition's number; 0 or less removes it. */
export function setConditionValue(enc: Encounter, id: Id, instanceId: Id, value: number): Encounter {
  return updateCombatant(enc, id, (c) => ({
    ...c,
    conditions: c.conditions
      .filter((x) => x.instanceId !== instanceId || value > 0)
      .map((x) =>
        x.instanceId === instanceId && x.value !== null ? { ...x, value: Math.min(MAX_CONDITION_VALUE, value) } : x,
      ),
  }));
}

/** Removes one applied condition (by instance). */
export function removeCondition(enc: Encounter, id: Id, instanceId: Id): Encounter {
  return updateCombatant(enc, id, (c) => ({
    ...c,
    conditions: c.conditions.filter((x) => x.instanceId !== instanceId),
  }));
}

/** Removes every instance of a condition (unchecking it in the picker). */
export function removeConditionType(enc: Encounter, id: Id, conditionId: Id): Encounter {
  return updateCombatant(enc, id, (c) => ({
    ...c,
    conditions: c.conditions.filter((x) => x.conditionId !== conditionId),
  }));
}

/** The highest value of a condition on the combatant; 0 when absent. */
export function conditionValue(c: Combatant, conditionId: Id): number {
  return c.conditions.reduce((max, x) => (x.conditionId === conditionId ? Math.max(max, x.value ?? 1) : max), 0);
}

/** Raises a valued condition by `by`, applying it at that value when absent (e.g. PF2e Wounded). */
export function raiseConditionValue(c: Combatant, cond: { id: Id; name: string }, by: number): Combatant {
  const existing = c.conditions.find((x) => x.conditionId === cond.id);
  if (existing) {
    return {
      ...c,
      conditions: c.conditions.map((x) =>
        x === existing ? { ...x, value: Math.min(MAX_CONDITION_VALUE, (x.value ?? 0) + by) } : x,
      ),
    };
  }
  const added = {
    instanceId: newId(),
    conditionId: cond.id,
    name: cond.name,
    value: by,
    dropsEachTurn: false,
    requiresResolve: false,
    resolvedThisTurn: false,
  };
  return { ...c, conditions: [...c.conditions, added] };
}

/** End of the creature's own turn: conditions that drop each turn lose 1, ending at 0. */
export function dropConditionValues(c: Combatant): Combatant {
  if (!c.conditions.some((x) => x.dropsEachTurn)) return c;
  return {
    ...c,
    conditions: c.conditions
      .map((x) => (x.dropsEachTurn && x.value !== null ? { ...x, value: x.value - 1 } : x))
      .filter((x) => x.value === null || x.value > 0),
  };
}
