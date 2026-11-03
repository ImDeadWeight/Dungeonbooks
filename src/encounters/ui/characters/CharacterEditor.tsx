/**
 * @file The create/edit character form: PC/NPC, name (with suggestions from
 * linked Lorekeeper notebooks), format, tags, dying rules, and the format's
 * stat block editor (or the Lorekeeper page's stat block).
 */
import { useCallback, useState } from 'react';
import type { CharacterKind, CharacterTemplate, LoreRef, StatBlock } from '../../domain/characters';
import type { FormatId } from 'campaign-link/formats/formatIds';
import type { DyingRules } from 'campaign-link/formats/formatTypes';
import { FORMAT_LIST, getFormat } from 'campaign-link/formats/registry';
import { encountersUsingTemplate } from '../../domain/library/tree';
import { sameContent } from '../../domain/transfer/plan';
import { newId, type Id } from '../../domain/ids';
import { useCharacters } from '../../state/characterStore';
import { useLibrary } from '../../state/libraryStore';
import { Select } from 'campaign-link/ui/common/Select';
import { closeUnlessDirty, useReportDirty } from '../common/unsavedChanges';
import { FORMAT_UI } from 'campaign-link/ui/formats/formatUi';
import { LoreNameField, LoreSourceChip, LoreStatBlockOffer } from './LoreNameField';
import { TagPicker } from './TagPicker';
import './characters.css';

/** The form's working copy; saved to the store only on "Save character". */
interface Draft {
  id: Id;
  name: string;
  kind: CharacterKind;
  formatId: FormatId | '';
  tagIds: Id[];
  deathSaves: boolean;
  skipStatBlock: boolean;
  statBlock: StatBlock | null;
  /** The Lorekeeper page it came from, if any. */
  lore: LoreRef | null;
}

/** Form state for an existing template, or a blank NPC (in the default format, if any) for a new one. */
function toDraft(t: CharacterTemplate | undefined, defaultFormatId: FormatId | null): Draft {
  if (!t) {
    const statBlock = defaultFormatId ? getFormat(defaultFormatId).createEmptyStatBlock() : null;
    return { id: newId(), name: '', kind: 'npc', formatId: defaultFormatId ?? '', tagIds: [], deathSaves: false, skipStatBlock: false, statBlock, lore: null };
  }
  return { ...t, skipStatBlock: t.statBlock === null, lore: t.lore ?? null };
}

/** Checkbox text for following the format's dying rules; null when the format has none. */
function dyingRulesLabel(dying: DyingRules): string | null {
  switch (dying.kind) {
    case 'deathSaves':
      return 'Makes death saves at 0 HP';
    case 'dyingValue':
      return 'Gets the Dying condition at 0 HP';
    case 'negativeHp':
      return 'Is dying (not dead) below 0 HP';
    case 'deadAtZero':
      return null;
  }
}

/** Props for CharacterEditor. */
interface Props {
  templateId: Id | null;
  /** Pre-selected format for a new character (the campaign's format); ignored when editing. */
  defaultFormatId?: FormatId | null;
  onDone(saved: CharacterTemplate | null): void;
  /** Told whether the form has unsaved changes, so the window around it can guard its close button. */
  onDirtyChange?(dirty: boolean): void;
}

/** Create or edit a character template. Used by the Create screen and the character library. */
export function CharacterEditor({ templateId, defaultFormatId = null, onDone, onDirtyChange }: Props) {
  const existing = useCharacters((s) => s.templates.find((t) => t.id === templateId));
  const [initial] = useState<Draft>(() => toDraft(existing, defaultFormatId));
  const [draft, setDraft] = useState<Draft>(initial);
  const dirty = !sameContent(draft, initial);
  useReportDirty(dirty, onDirtyChange);
  // Merge a partial change into the draft.
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  // Stable callback for the tag picker (its effects depend on it).
  const setTagIds = useCallback((tagIds: Id[]) => setDraft((d) => ({ ...d, tagIds })), []);
  // Encounters use one format each, so a character already in one keeps its format.
  const usedIn = useLibrary((s) => (templateId ? encountersUsingTemplate(s, templateId).length : 0));

  // Switch format; a format with another stat block type starts a fresh stat block.
  const chooseFormat = (formatId: FormatId | '') => {
    const keeps =
      !formatId ||
      (draft.formatId !== '' && draft.statBlock !== null && getFormat(formatId).statBlockType === getFormat(draft.formatId).statBlockType);
    set({ formatId, statBlock: formatId ? (keeps ? draft.statBlock : getFormat(formatId).createEmptyStatBlock()) : null });
  };

  // Reasons Save is disabled, shown next to the button.
  const errors = [!draft.name.trim() && 'Enter a name', !draft.formatId && 'Pick a format'].filter(Boolean) as string[];

  // Validate, build the template (PCs always use death saves) and store it.
  const save = () => {
    if (errors.length > 0 || !draft.formatId) return;
    const template: CharacterTemplate = {
      id: draft.id,
      name: draft.name.trim(),
      kind: draft.kind,
      formatId: draft.formatId,
      tagIds: draft.tagIds,
      deathSaves: draft.kind === 'pc' || draft.deathSaves,
      statBlock: draft.skipStatBlock ? null : draft.statBlock,
      ...(draft.lore && { lore: draft.lore }),
    };
    useCharacters.getState().saveTemplate(template);
    onDone(template);
  };

  // The stat block editor for the chosen format, if any.
  const Editor = draft.formatId ? FORMAT_UI[draft.formatId].Editor : null;
  // How the format's dying rules are described (before a format is picked: 5e-style wording).
  const dyingLabel = draft.formatId ? dyingRulesLabel(getFormat(draft.formatId).dying) : 'Makes death saves at 0 HP';

  return (
    <div className="character-editor">
      <div className="character-basics">
        <label className="field">
          Type
          <Select<CharacterKind>
            value={draft.kind}
            options={[
              { value: 'npc', label: 'NPC' },
              { value: 'pc', label: 'Player character' },
            ]}
            onChange={(kind) => set({ kind })}
          />
        </label>
        <LoreNameField
          name={draft.name}
          lore={draft.lore}
          templateId={draft.id}
          onName={(name) => set({ name })}
          onPick={(c) => set({ name: c.title, kind: c.kind, lore: { notebookId: c.notebookId, pageId: c.pageId } })}
        />
        <label className="field">
          Format
          <Select<FormatId | ''>
            value={draft.formatId}
            placeholder="Select…"
            disabled={usedIn > 0}
            title={usedIn > 0 ? 'Used in an encounter; remove it from every encounter to change its format' : undefined}
            options={FORMAT_LIST.map((f) => ({ value: f.id, label: f.name }))}
            onChange={chooseFormat}
          />
        </label>
      </div>
      <LoreSourceChip lore={draft.lore} onForget={() => set({ lore: null })} />
      <LoreStatBlockOffer
        lore={draft.lore}
        current={draft.formatId && draft.statBlock && !draft.skipStatBlock ? { formatId: draft.formatId, statBlock: draft.statBlock } : null}
        lockedFormatId={usedIn > 0 && draft.formatId ? draft.formatId : null}
        onTake={({ formatId, statBlock }) => set({ formatId, statBlock, skipStatBlock: false })}
      />

      {/* Not a <label>: clicking a label would activate the first chip's remove button. */}
      <div className="field">
        <span>Tags</span>
        <TagPicker
          tagIds={draft.tagIds}
          lockedLabel={draft.formatId ? getFormat(draft.formatId).name : undefined}
          onChange={setTagIds}
        />
      </div>

      <div className="row wrap">
        {dyingLabel && (
          <label className="inline" title={draft.kind === 'pc' ? 'Player characters always follow the dying rules' : undefined}>
            <input
              type="checkbox"
              checked={draft.kind === 'pc' || draft.deathSaves}
              disabled={draft.kind === 'pc'}
              onChange={(e) => set({ deathSaves: e.target.checked })}
            />
            {dyingLabel}
          </label>
        )}
        <label className="inline">
          <input
            type="checkbox"
            checked={draft.skipStatBlock}
            onChange={(e) =>
              set({
                skipStatBlock: e.target.checked,
                statBlock: draft.statBlock ?? (draft.formatId ? getFormat(draft.formatId).createEmptyStatBlock() : null),
              })
            }
          />
          No stat block
        </label>
      </div>
      {draft.skipStatBlock && draft.kind === 'pc' && (
        <p className="muted">Without a stat block, HP isn't tracked. Use Drop and Revive in combat when the player goes down.</p>
      )}

      {Editor && draft.statBlock && !draft.skipStatBlock && (
        <Editor value={draft.statBlock} kind={draft.kind} onChange={(statBlock) => set({ statBlock })} />
      )}

      <div className="row editor-actions">
        <span className="muted spacer">{errors.join(' · ')}</span>
        <button type="button" onClick={() => closeUnlessDirty(dirty, () => onDone(null))}>Cancel</button>
        <button type="button" className="primary" disabled={errors.length > 0} onClick={save}>
          Save character
        </button>
      </div>
    </div>
  );
}
