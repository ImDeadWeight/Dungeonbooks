/**
 * @file Side-initiative formats (B/X): which side a combatant acts with.
 * Suggests the sides already in the encounter; typing a new name makes a
 * new side, which rolls its own initiative during combat.
 */
import { useEffect, useId, useState } from 'react';
import { MONSTER_SIDE, PARTY_SIDE, setCombatantSide, sideOf } from '../../domain/combat/initiative';
import type { Combatant } from '../../domain/combat/types';
import type { Encounter } from '../../domain/library/types';
import { runCombatAction } from '../../state/combatStore';
import { useCombatRules } from '../../state/useCombatRules';

/** Side name box with suggestions; saved on blur/Enter. Renders nothing outside side-initiative formats. */
export function SideField({ encounter, combatant }: { encounter: Encounter; combatant: Combatant }) {
  const rules = useCombatRules(encounter.formatId);
  const current = sideOf(combatant, rules);
  const [value, setValue] = useState(current);
  const listId = useId();
  useEffect(() => setValue(current), [combatant.id, current]);
  if (rules.initiativeMode !== 'sides') return null;

  const known = [...new Set([PARTY_SIDE, MONSTER_SIDE, ...encounter.combatants.map((c) => sideOf(c, rules))])];
  // Save the side if it changed (blank goes back to the default for PC/NPC).
  const commit = () => {
    if (value.trim() === current) return;
    runCombatAction(encounter.id, `${combatant.name}: side ${value.trim() || 'default'}`, (enc, r) =>
      setCombatantSide(enc, combatant.id, value, r),
    );
  };

  return (
    <label className="inline side-field" title="Everyone on a side acts together; each side rolls initiative every round">
      Side
      <input
        list={listId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <datalist id={listId}>
        {known.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </label>
  );
}
