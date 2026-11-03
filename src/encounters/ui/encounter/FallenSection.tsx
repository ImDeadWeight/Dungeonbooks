/**
 * @file Collapsible Stabilized / Killed lists below the initiative order, with
 * Restore buttons.
 */
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { restoreCombatant } from '../../domain/combat/status';
import type { Combatant } from '../../domain/combat/types';
import type { Encounter } from '../../domain/library/types';
import { runCombatAction } from '../../state/combatStore';
import { useUi } from '../../state/uiStore';

/** Props for FallenSection. */
interface Props {
  encounter: Encounter;
  title: string;
  combatants: Combatant[];
}

/** Collapsible list of combatants out of the order (killed or stabilized). */
export function FallenSection({ encounter, title, combatants }: Props) {
  const [open, setOpen] = useState(false);
  const openCombatant = useUi((s) => s.openCombatant);
  if (combatants.length === 0) return null;
  return (
    <div className="fallen-section">
      <button className="fallen-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {title} ({combatants.length})
      </button>
      {open &&
        combatants.map((c) => (
          <div key={c.id} className="fallen-row" onClick={() => openCombatant(encounter.id, c.id)}>
            <span>{c.name}</span>
            {c.tokenDescription && <span className="muted"> · {c.tokenDescription}</span>}
            <span className="spacer" />
            <button
              title="Return to the initiative order"
              onClick={(e) => {
                e.stopPropagation();
                runCombatAction(encounter.id, `Restore ${c.name}`, (enc) => restoreCombatant(enc, c.id));
              }}
            >
              Restore
            </button>
          </div>
        ))}
    </div>
  );
}
