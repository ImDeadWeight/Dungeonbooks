/**
 * @file Editable "Token description" box linking a combatant to its physical
 * game piece.
 */
import { useEffect, useState } from 'react';
import { updateCombatant } from '../../domain/combat/update';
import type { Combatant } from '../../domain/combat/types';
import type { Id } from '../../domain/ids';
import { runCombatAction } from '../../state/combatStore';

/** Free text matching the combatant to a physical token. Saved on blur/Enter. */
export function TokenDescription({ encounterId, combatant }: { encounterId: Id; combatant: Combatant }) {
  const [value, setValue] = useState(combatant.tokenDescription);
  useEffect(() => setValue(combatant.tokenDescription), [combatant.id, combatant.tokenDescription]);

  // Save the trimmed text if it changed (on blur or Enter).
  const commit = () => {
    const text = value.trim();
    if (text === combatant.tokenDescription) return;
    runCombatAction(encounterId, `${combatant.name}: token description`, (enc) =>
      updateCombatant(enc, combatant.id, (c) => ({ ...c, tokenDescription: text })),
    );
  };

  return (
    <input
      className="token-input"
      placeholder="Token description"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}
