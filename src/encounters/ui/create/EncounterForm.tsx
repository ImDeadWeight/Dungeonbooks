/**
 * @file Create-encounter form: name, campaign/area, format, and the
 * character cart.
 */
import { useState } from 'react';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { addToCombatants } from '../../domain/library/combatantFactory';
import type { Id } from '../../domain/ids';
import { useCharacters } from '../../state/characterStore';
import { useLibrary } from '../../state/libraryStore';
import { useUi } from '../../state/uiStore';
import { FormatField } from '../common/FormatField';
import { useReportDirty } from '../common/unsavedChanges';
import { CartBuilder } from './CartBuilder';
import { ParentPicker } from './ParentPicker';
import { useCart } from './useCart';

/** Initial campaign/area (pre-filled by inline + buttons). */
interface Props {
  campaignId: Id | null;
  areaId: Id | null;
  onDirtyChange(dirty: boolean): void;
}

/** The default format of a campaign, or '' for none. */
function campaignFormat(campaignId: Id | null): FormatId | '' {
  return useLibrary.getState().campaigns.find((c) => c.id === campaignId)?.formatId ?? '';
}

/** Builds a new encounter from the cart and selects it. */
export function EncounterForm(props: Props) {
  const [name, setName] = useState('');
  const [parents, setParents] = useState({ campaignId: props.campaignId, areaId: props.areaId });
  // Starts as the campaign's format; follows the campaign until picked by hand.
  const [initialFormat] = useState(() => campaignFormat(props.campaignId));
  const [formatId, setFormatId] = useState<FormatId | ''>(initialFormat);
  const [formatPicked, setFormatPicked] = useState(false);
  const cart = useCart();
  const moved = parents.campaignId !== props.campaignId || parents.areaId !== props.areaId;
  useReportDirty(name !== '' || cart.lines.length > 0 || moved || formatId !== initialFormat, props.onDirtyChange);

  // Characters must match the encounter's format, so a new format empties the cart.
  const changeFormat = (next: FormatId | '') => {
    if (next !== formatId) cart.clear();
    setFormatId(next);
  };
  const changeParents = (next: typeof parents) => {
    setParents(next);
    const fallback = campaignFormat(next.campaignId);
    if (!formatPicked && fallback && cart.lines.length === 0) changeFormat(fallback);
  };

  // Create the encounter with the cart's combatants, select it, close the dialog.
  const create = () => {
    if (!formatId) return;
    const lookup = (id: string) => useCharacters.getState().templates.find((t) => t.id === id);
    const id = useLibrary.getState().addEncounter({
      name: name.trim(),
      ...parents,
      formatId,
      combatants: addToCombatants([], cart.lines, lookup, formatId),
    });
    const ui = useUi.getState();
    ui.selectEncounter(id);
    ui.closeModal();
  };

  return (
    <>
      <div className="create-fields">
        <label className="field grow">
          Encounter name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <ParentPicker {...parents} requireCampaign={false} showArea onChange={changeParents} />
        <FormatField
          value={formatId}
          title="The game system for this encounter; only its characters can be added"
          onChange={(f) => {
            setFormatPicked(true);
            changeFormat(f);
          }}
        />
        <button className="primary big" disabled={!name.trim() || !formatId} title={formatId ? undefined : 'Pick a format'} onClick={create}>
          Create Encounter
        </button>
      </div>
      <CartBuilder cart={cart} formatId={formatId || null} />
    </>
  );
}
