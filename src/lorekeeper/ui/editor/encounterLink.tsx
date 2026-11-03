/**
 * @file The encounter-link node: a chip in page text that points at an
 * encounter in the linked Encounters campaign. It stores the encounter's id
 * (and its name when linked, shown if Encounters isn't available), and shows
 * the encounter's current name and combat state. Clicking it opens the
 * encounter in Encounters.
 */
import { mergeAttributes, Node, type Editor } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { Swords } from 'lucide-react';
import type { Id } from '../../domain/ids';
import { openInEncounters } from '../../state/appLinks';
import { useOpenNotebookCatalog } from '../../state/campaignLink';
import { EncounterStateBadge } from '../encounters/EncounterState';

/** Node name in saved page content. */
export const ENCOUNTER_LINK = 'encounterLink';

/** The chip as drawn in the editor. */
function EncounterChip({ node }: NodeViewProps) {
  const { encounterId, name } = node.attrs as { encounterId: Id; name: string };
  const catalog = useOpenNotebookCatalog();
  const encounter = catalog?.encounters.find((e) => e.id === encounterId);
  // Missing only means something when the catalogue is there to look in.
  const missing = !!catalog && !encounter;

  return (
    <NodeViewWrapper as="span" className={`encounter-chip${missing ? ' missing' : ''}`} contentEditable={false}>
      <button
        type="button"
        title={missing ? 'This encounter is no longer in the linked Encounters campaign' : 'Open in Encounters'}
        // Don't move the caret or select the chip; just open it.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => openInEncounters({ app: 'encounters', kind: 'encounter', encounterId })}
      >
        <Swords size={13} />
        <span className="encounter-chip-name">{encounter?.name ?? name ?? 'Encounter'}</span>
        {encounter && <EncounterStateBadge encounter={encounter} />}
      </button>
    </NodeViewWrapper>
  );
}

export const EncounterLink = Node.create({
  name: ENCOUNTER_LINK,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      encounterId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-encounter-id'),
        renderHTML: (attrs) => ({ 'data-encounter-id': attrs.encounterId }),
      },
      name: {
        default: '',
        parseHTML: (el) => el.textContent ?? '',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-encounter-id]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'encounter-chip' }), node.attrs.name];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EncounterChip);
  },
});

/** Inserts an encounter chip (and a space after it) at the editor's caret. */
export function insertEncounterLink(editor: Editor, encounter: { id: Id; name: string }) {
  editor
    .chain()
    .focus()
    .insertContent([
      { type: ENCOUNTER_LINK, attrs: { encounterId: encounter.id, name: encounter.name } },
      { type: 'text', text: ' ' },
    ])
    .run();
}
