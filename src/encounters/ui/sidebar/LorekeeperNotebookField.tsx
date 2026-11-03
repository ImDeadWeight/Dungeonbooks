/**
 * @file The campaign editor's Lorekeeper field: which Lorekeeper notebook the
 * campaign is linked to.
 */
import { useCatalogs } from '../../../bridge/catalogs';
import { useLinks } from '../../../bridge/links';
import type { Id } from '../../domain/ids';

/** Notebook picker plus the link's status. `value` is the chosen notebook (applied when the dialog saves). */
export function LorekeeperNotebookField({ campaignId, value, onChange }: { campaignId: Id; value: Id | null; onChange(v: Id | null): void }) {
  const allNotebooks = useCatalogs((s) => s.notebooks);
  const links = useLinks((s) => s.notebookByCampaign);
  const saved = links[campaignId] ?? null;

  const notebooks = [...allNotebooks].sort((a, b) => a.name.localeCompare(b.name));
  // The saved link's notebook stays listed (as missing) if it was deleted.
  const knownSaved = !saved || notebooks.some((n) => n.id === saved);
  /** The campaign another notebook is linked to, if not this one. */
  const linkedElsewhere = (notebookId: Id) => Object.keys(links).some((c) => c !== campaignId && links[c] === notebookId);

  return (
    <label className="field">
      Lorekeeper notebook
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Not linked</option>
        {!knownSaved && saved && <option value={saved}>(notebook not found)</option>}
        {notebooks.map((n) => {
          const elsewhere = linkedElsewhere(n.id);
          return (
            <option key={n.id} value={n.id} disabled={elsewhere}>
              {n.name}
              {elsewhere ? ' (linked to another campaign)' : ''}
            </option>
          );
        })}
      </select>
      <span className="muted">
        {saved !== value
          ? 'Saved when you press Save.'
          : saved
            ? 'Linked: the Lorekeeper tab shows this campaign.'
            : "Link a notebook to suggest its characters and places here, and show this campaign's encounters there."}
      </span>
    </label>
  );
}
