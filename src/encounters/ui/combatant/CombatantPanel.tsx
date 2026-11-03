/**
 * @file Right panel: the selected combatant's name (with a button to its
 * Lorekeeper page, if it came from one), status, token description, stat
 * block, and trackers (health, dying rolls, conditions).
 */
import { ArrowLeft, BookOpen } from 'lucide-react';
import type { Combatant } from '../../domain/combat/types';
import type { Encounter } from '../../domain/library/types';
import { openInLorekeeper } from '../../state/appLinks';
import { useCharacters } from '../../state/characterStore';
import { useEncounter } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';
import { useCombatRules } from '../../state/useCombatRules';
import { DyingButtons, dyingLabel, DyingTally, dyingTrackerTitle } from '../encounter/DyingControls';
import { StatBlockView } from '../formats/StatBlockView';
import { ConditionTracker } from './ConditionTracker';
import { HealthTracker } from './HealthTracker';
import { SideField } from './SideField';
import { TokenDescription } from './TokenDescription';
import './combatant.css';

/** Status line under the name: how dying is called in the format, Stabilized or Killed; nothing while active. */
function StatusLine({ encounter, combatant: c }: { encounter: Encounter; combatant: Combatant }) {
  const rules = useCombatRules(encounter.formatId);
  if (c.status === 'active') return null;
  const text = c.status === 'dying' ? dyingLabel(rules) : c.status === 'stable' ? 'Stabilized' : 'Killed';
  return <div className={`status-line ${c.status}`}>{text}</div>;
}

/** Health, dying rolls (when dying and not their turn) and conditions for one combatant. */
function Trackers({ encounter, combatant }: { encounter: Encounter; combatant: Combatant }) {
  const rules = useCombatRules(encounter.formatId);
  const isTheirTurn = encounter.combat.currentId === combatant.id;
  return (
    <div className="trackers">
      <HealthTracker key={combatant.id} encounterId={encounter.id} combatant={combatant} />
      {/* On their turn the dying roll buttons sit on their initiative row instead. */}
      {combatant.status === 'dying' && !isTheirTurn && (
        <div className="tracker">
          <div className="tracker-title">
            <h4>{dyingTrackerTitle(rules)}</h4>
            <DyingTally combatant={combatant} rules={rules} />
          </div>
          <DyingButtons encounterId={encounter.id} combatant={combatant} rules={rules} />
        </div>
      )}
      <ConditionTracker
        key={`cond-${combatant.id}`}
        encounterId={encounter.id}
        combatant={combatant}
        formatId={encounter.formatId}
        isTheirTurn={isTheirTurn}
      />
    </div>
  );
}

/** Shows whichever combatant is selected in the current encounter. */
export function CombatantPanel() {
  const encounterId = useUi((s) => s.selectedEncounterId);
  const encounter = useEncounter(encounterId);
  const selectedId = useUi((s) => (encounterId ? s.selectedCombatant[encounterId] : null));
  const combatant = encounter?.combatants.find((c) => c.id === selectedId);
  const template = useCharacters((s) => s.templates.find((t) => t.id === combatant?.templateId));

  if (!encounter || !combatant) {
    return (
      <aside className="panel combatant-panel">
        <button className="icon phone-only" title="Back to the initiative order" onClick={() => useUi.getState().closeDetails()}>
          <ArrowLeft size={18} />
        </button>
        <p className="empty-state">Select a character in the initiative order.</p>
      </aside>
    );
  }

  return (
    <aside className="panel combatant-panel">
      <div className="combatant-header">
        <div className="row">
          <button className="icon phone-only" title="Back to the initiative order" onClick={() => useUi.getState().closeDetails()}>
            <ArrowLeft size={18} />
          </button>
          <h2 className="spacer">{combatant.name}</h2>
          {template?.lore && (
            <button className="icon" title="Open in Lorekeeper" onClick={() => openInLorekeeper(template.lore!)}>
              <BookOpen size={18} />
            </button>
          )}
          <span className="chip">{template?.kind === 'pc' ? 'PC' : 'NPC'}</span>
        </div>
        <StatusLine encounter={encounter} combatant={combatant} />
        <TokenDescription encounterId={encounter.id} combatant={combatant} />
        <SideField encounter={encounter} combatant={combatant} />
      </div>
      <div className="statblock-scroll">
        {template?.statBlock ? (
          <StatBlockView template={template} />
        ) : (
          <p className="muted">{template ? 'No stat block.' : 'The character template for this entry is missing.'}</p>
        )}
      </div>
      <Trackers encounter={encounter} combatant={combatant} />
    </aside>
  );
}
