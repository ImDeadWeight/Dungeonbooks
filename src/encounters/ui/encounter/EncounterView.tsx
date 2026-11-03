/**
 * @file Main panel: the selected encounter's header, initiative list,
 * Stabilized/Killed sections, and initiative prompt.
 */
import { awaitingInitiative, turnOrder } from '../../domain/combat/initiative';
import { isInOrder } from '../../domain/combat/types';
import type { Encounter } from '../../domain/library/types';
import { useEncounter } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';
import { useCombatRules } from '../../state/useCombatRules';
import { CombatantRow } from './CombatantRow';
import { EncounterHeader, TurnBlockers } from './EncounterHeader';
import { FallenSection } from './FallenSection';
import { InitiativePrompt } from './InitiativePrompt';
import './encounter.css';

/** Combatants in initiative order during combat, otherwise in the order added. */
function InitiativeList({ encounter }: { encounter: Encounter }) {
  const rules = useCombatRules(encounter.formatId);
  // In combat: initiative order. Outside combat: the order characters were added.
  const rows = encounter.combat.active
    ? turnOrder(encounter, rules)
    : encounter.combatants.filter(isInOrder).sort((a, b) => a.addedOrder - b.addedOrder);

  if (encounter.combatants.length === 0) {
    return <p className="empty-state">No characters yet. Use the add-characters button above.</p>;
  }
  return (
    <div className="initiative-list">
      {rows.map((c) => (
        <CombatantRow key={c.id} encounter={encounter} combatant={c} />
      ))}
    </div>
  );
}

/** The main panel for the selected encounter (or a hint when none is selected). */
export function EncounterView() {
  const encounterId = useUi((s) => s.selectedEncounterId);
  const encounter = useEncounter(encounterId);

  if (!encounter) {
    return (
      <main className="panel main-panel">
        <p className="empty-state">Select an encounter from the sidebar, or create one with the + button.</p>
      </main>
    );
  }

  // Combatants out of the order with the given status.
  const fallen = (status: 'stable' | 'dead') => encounter.combatants.filter((c) => c.status === status);

  return (
    <main className="panel main-panel">
      <EncounterHeader encounter={encounter} />
      <TurnBlockers encounter={encounter} />
      <div className="panel-body">
        <InitiativeList encounter={encounter} />
        <FallenSection encounter={encounter} title="Stabilized" combatants={fallen('stable')} />
        <FallenSection encounter={encounter} title="Killed" combatants={fallen('dead')} />
      </div>
      {awaitingInitiative(encounter).length > 0 && <InitiativePrompt key={encounter.id} encounter={encounter} />}
    </main>
  );
}
