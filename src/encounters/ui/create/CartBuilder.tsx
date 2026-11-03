/**
 * @file The encounter "shopping cart": search/filter characters of the
 * encounter's format on the left, chosen characters and quantities on the
 * right.
 */
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EMPTY_FILTER, filterTemplates } from '../../domain/characterSearch';
import type { CharacterTemplate } from '../../domain/characters';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { useCharacters } from '../../state/characterStore';
import { useUi } from '../../state/uiStore';
import { CharacterFilterBar } from '../characters/CharacterFilterBar';
import { NumberInput } from 'campaign-link/ui/common/fields';
import { QuantityPrompt } from './QuantityPrompt';
import type { Cart } from './useCart';
import './create.css';

/** Props for CartBuilder. */
interface Props {
  cart: Cart;
  alreadyIn?: string[];
  /** The encounter's format: only its characters are offered, and "New character" starts in it. Null = not picked yet. */
  formatId: FormatId | null;
}

/** Search/filter characters on the left, the cart on the right. */
export function CartBuilder({ cart, alreadyIn = [], formatId }: Props) {
  const templates = useCharacters((s) => s.templates);
  const openModal = useUi((s) => s.openModal);
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [asking, setAsking] = useState<CharacterTemplate | null>(null);
  const shown = filterTemplates(templates.filter((t) => t.formatId === formatId), filter);
  // Find a template by id.
  const lookup = (id: string) => templates.find((t) => t.id === id);

  // NPCs ask for a quantity first; PCs go straight in (once).
  const pick = (t: CharacterTemplate) => (t.kind === 'npc' ? setAsking(t) : cart.add(t, 1));

  return (
    <div className="cart-builder">
      <section className="cart-picker">
        <div className="row">
          <h3 className="spacer">Characters</h3>
          <button disabled={!formatId} onClick={() => openModal({ type: 'editCharacter', templateId: null, defaultFormatId: formatId })}>
            <Plus size={16} /> New character
          </button>
        </div>
        <CharacterFilterBar filter={filter} onChange={setFilter} />
        <div className="character-list">
          {!formatId && <p className="empty-state">Pick the encounter's format to see its characters.</p>}
          {formatId && shown.length === 0 && <p className="empty-state">No characters match.</p>}
          {shown.map((t) => {
            // A PC can only be in an encounter once.
            const pcInCart =
              t.kind === 'pc' && (alreadyIn.includes(t.id) || cart.lines.some((l) => l.templateId === t.id));
            return (
              <div key={t.id} className="character-item">
                <span className="name">{t.name}</span>
                <span className="chip">{t.kind === 'pc' ? 'PC' : 'NPC'}</span>
                <button className="icon" title="Add to encounter" disabled={pcInCart} onClick={() => pick(t)}>
                  <Plus size={18} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <section className="cart">
        <h3>In this encounter</h3>
        {cart.lines.length === 0 && <p className="muted">Nothing added yet.</p>}
        {cart.lines.map((line) => {
          const t = lookup(line.templateId);
          if (!t) return null;
          return (
            <div key={line.templateId} className="character-item">
              <span className="name">{t.name}</span>
              {t.kind === 'npc' ? (
                <NumberInput value={line.quantity} min={1} onChange={(n) => cart.setQuantity(t.id, n)} />
              ) : (
                <span className="chip">PC</span>
              )}
              <button className="icon" title="Remove" onClick={() => cart.remove(t.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </section>
      {asking && (
        <QuantityPrompt
          name={asking.name}
          onCancel={() => setAsking(null)}
          onConfirm={(n) => {
            cart.add(asking, n);
            setAsking(null);
          }}
        />
      )}
    </div>
  );
}
