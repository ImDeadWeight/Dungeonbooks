/**
 * @file The Link encounter button and picker: a searchable list of the open
 * campaign's encounters. Picking
 * one puts an encounter chip where the caret last was on this page, or in a
 * new box when no box on the page has been used yet.
 */
import { areaPath, type LinkEncounter } from 'campaign-link';
import { Swords } from 'lucide-react';
import { useState } from 'react';
import type { Id } from '../../domain/ids';
import { byName } from '../../domain/notebook';
import { useOpenNotebookCatalog } from '../../state/campaignLink';
import { useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';
import { Modal } from '../../../ui/Modal';
import { ENCOUNTER_LINK, insertEncounterLink } from '../editor/encounterLink';
import { lastEditorOn } from '../editor/lastEditor';
import { EncounterStateBadge } from './EncounterState';

/** Where a new box goes when there's no box to insert into: below everything on the page. */
const NEW_BOX_X = 40;
const NEW_BOX_GAP = 140;

/** Puts an encounter chip on a page: at the caret of the box last used there, or in a new box. */
function placeEncounterLink(pageId: Id, encounter: LinkEncounter) {
  const editor = lastEditorOn(pageId);
  if (editor) {
    insertEncounterLink(editor, encounter);
    return;
  }
  const notebook = useNotebook.getState();
  const page = notebook.pages.find((p) => p.id === pageId);
  const y = page && page.boxes.length ? Math.max(...page.boxes.map((b) => b.y)) + NEW_BOX_GAP : 40;
  const boxId = notebook.addBox(pageId, NEW_BOX_X, y);
  notebook.setBoxContent(pageId, boxId, {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: ENCOUNTER_LINK, attrs: { encounterId: encounter.id, name: encounter.name } }, { type: 'text', text: ' ' }] }],
  });
  useUi.getState().setFocusBox(boxId);
}

/** The page header's Link encounter button. */
export function LinkEncounterButton({ pageId }: { pageId: Id }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="link-encounter-button"
        title="Link one of this campaign's encounters"
        // Keep the caret in the box being written in.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(true)}
      >
        <Swords size={15} /> Link encounter
      </button>
      {open && <LinkEncounterDialog pageId={pageId} close={() => setOpen(false)} />}
    </>
  );
}

/** Searchable list of the campaign's encounters. */
function LinkEncounterDialog({ pageId, close }: { pageId: Id; close: () => void }) {
  const catalog = useOpenNotebookCatalog();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = (catalog?.encounters ?? [])
    .map((e) => ({ encounter: e, path: areaPath(catalog!, e.areaId) }))
    .filter(({ encounter, path }) => !q || [encounter.name, ...path].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => byName(a.path.join(' › '), b.path.join(' › ')) || byName(a.encounter.name, b.encounter.name));

  return (
    <Modal
      title={catalog ? `Link an encounter from "${catalog.name}"` : 'Link an encounter'}
      size="small"
      onClose={close}
      footer={<button onClick={close}>Cancel</button>}
    >
      {!catalog ? (
        <p className="muted">Waiting for Encounters to share this campaign's encounters…</p>
      ) : (
        <div className="link-encounter-picker">
          <input autoFocus placeholder="Search encounters and areas" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="link-encounter-list">
            {rows.length === 0 && <p className="muted">{catalog.encounters.length ? 'No encounters match.' : 'This campaign has no encounters yet.'}</p>}
            {rows.map(({ encounter, path }) => (
              <button
                key={encounter.id}
                className="link-encounter-option"
                onClick={() => {
                  placeEncounterLink(pageId, encounter);
                  close();
                }}
              >
                <Swords size={15} />
                <span className="spacer">
                  {encounter.name}
                  {path.length > 0 && <span className="muted"> · {path.join(' › ')}</span>}
                </span>
                <EncounterStateBadge encounter={encounter} />
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
