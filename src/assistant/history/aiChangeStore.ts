/**
 * @file The open campaign's AI changes, saved beside its notes as
 * ai-changes-<campaign id>.json: loaded at startup and whenever a campaign
 * opens, saved after each change is recorded or undone, and deleted with
 * the campaign.
 */
import { create } from 'zustand';
import { useCampaigns } from '../../campaigns/campaignStore';
import { registerParticipant } from '../../campaigns/lifecycle';
import { loadDocument, removeDocument, saveDocument } from '../../lorekeeper/storage/documents';
import { addChange, type AiChange } from './aiChanges';

interface AiChangesState {
  /** The campaign the list belongs to. */
  campaignId: string | null;
  /** Oldest first. */
  changes: AiChange[];
}

export const useAiChanges = create<AiChangesState>(() => ({ campaignId: null, changes: [] }));

const changesDoc = (campaignId: string) => `ai-changes-${campaignId}`;

/** Writes run one at a time, so two saves can't interleave. */
let writes: Promise<unknown> = Promise.resolve();

function save() {
  const { campaignId, changes } = useAiChanges.getState();
  if (!campaignId) return;
  writes = writes.then(() => saveDocument(changesDoc(campaignId), { changes })).catch((e) => console.error('Could not save AI changes', e));
}

async function load(campaignId: string) {
  await writes;
  const loaded = await loadDocument(changesDoc(campaignId), () => ({ changes: [] as AiChange[] }));
  useAiChanges.setState({ campaignId, changes: loaded.data.changes });
}

/** Adds a change to the open campaign's list. */
export function recordChange(change: AiChange) {
  useAiChanges.setState((s) => ({ changes: addChange(s.changes, change) }));
  save();
}

/** Marks a change undone. */
export function markUndone(id: string) {
  useAiChanges.setState((s) => ({ changes: s.changes.map((c) => (c.id === id ? { ...c, undoneAt: Date.now() } : c)) }));
  save();
}

/** Loads the open campaign's list, then follows campaigns being opened and deleted. */
export async function startAiChanges(): Promise<void> {
  const id = useCampaigns.getState().activeId;
  if (id) await load(id);
  registerParticipant({
    opening: (campaignId) => load(campaignId),
    deleted: (campaignId) => removeDocument(changesDoc(campaignId)),
  });
}
