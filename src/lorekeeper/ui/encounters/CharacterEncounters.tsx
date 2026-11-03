/**
 * @file The Encounters strip on a Character page: every encounter in the
 * linked Encounters campaign this character is in (through characters made
 * from this page), whether its combat is running, and how the character is
 * doing in it. Clicking one opens it in Encounters.
 */
import { areaPath, encountersForLorePage } from 'campaign-link';
import { Swords } from 'lucide-react';
import type { Page } from '../../domain/notebook';
import { openInEncounters } from '../../state/appLinks';
import { useOpenNotebookCatalog, useOpenNotebookLinkStatus } from '../../state/campaignLink';
import { EncounterStateBadge, statusWords } from './EncounterState';

/** Shown under a Character page's title. */
export function CharacterEncounters({ page }: { page: Page }) {
  const status = useOpenNotebookLinkStatus();
  const catalog = useOpenNotebookCatalog();

  if (status !== 'linked' || !catalog) {
    return (
      <div className="character-encounters">
        <span className="muted">Link this notebook to an Encounters campaign (notebook menu) to see the encounters {page.title} is in.</span>
      </div>
    );
  }

  const encounters = encountersForLorePage(catalog, page.id);
  // Characters made from this page (to report how their combatants are doing).
  const fromThisPage = new Set(catalog.characters.filter((c) => c.lorePageId === page.id).map((c) => c.id));
  if (encounters.length === 0) {
    return (
      <div className="character-encounters">
        <span className="muted">
          {fromThisPage.size > 0
            ? `Not in any encounters in "${catalog.name}" yet.`
            : `Not in any encounters in "${catalog.name}". In Encounters, pick ${page.title} from the name suggestions when creating a character.`}
        </span>
      </div>
    );
  }


  return (
    <div className="character-encounters">
      <span className="character-encounters-title muted">Encounters</span>
      {encounters.map((encounter) => {
        const path = areaPath(catalog, encounter.areaId);
        const mine = encounter.combatants.filter((c) => fromThisPage.has(c.characterId));
        const hurt = mine
          .map((c) => ({ name: c.name, words: statusWords(c.status) }))
          .filter((c) => c.words)
          .map((c) => (mine.length > 1 ? `${c.name}: ${c.words}` : c.words));
        return (
          <button
            key={encounter.id}
            className={`encounter-entry${encounter.inCombat ? ' live' : ''}`}
            title={`Open "${encounter.name}" in Encounters`}
            onClick={() => openInEncounters({ app: 'encounters', kind: 'encounter', encounterId: encounter.id })}
          >
            <Swords size={14} />
            <span>
              {encounter.name}
              {path.length > 0 && <span className="muted"> · {path.join(' › ')}</span>}
            </span>
            <EncounterStateBadge encounter={encounter} />
            {hurt.length > 0 && <span className="encounter-hurt">{hurt.join(', ')}</span>}
          </button>
        );
      })}
    </div>
  );
}
