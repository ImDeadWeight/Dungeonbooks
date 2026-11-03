/**
 * @file Which tab is showing, and opening something in the other tab: each
 * tab registers how it opens its own things (an encounter, a character, a
 * page), and links in the other tab switch to it and open them. These are the
 * targets the separate apps opened with encounters:// and lorekeeper:// links.
 */
import type { LinkTarget } from 'campaign-link';
import { create } from 'zustand';
import { sharedDocuments } from './sharedDocuments';

export type Tab = LinkTarget['app'];

/** The shell's document (which tab was showing). */
const VIEW_DOC = 'view';

interface TabsState {
  tab: Tab;
}

export const useTabs = create<TabsState>(() => ({ tab: 'encounters' }));

/** Shows a tab. */
export function showTab(tab: Tab) {
  useTabs.setState({ tab });
}

/** Opens one of a tab's own things. */
type Opener = (target: LinkTarget) => void;
const openers: Partial<Record<Tab, Opener>> = {};

/** Says how a tab opens its own things. */
export function registerOpener(tab: Tab, open: Opener) {
  openers[tab] = open;
}

/** Shows the target's tab and opens the target there. */
export function openTarget(target: LinkTarget) {
  showTab(target.app);
  openers[target.app]?.(target);
}

/** Reopens the tab that was showing last time, then remembers each change. */
export async function startTabs(): Promise<void> {
  const loaded = await sharedDocuments.loadDocument<TabsState>(VIEW_DOC, () => ({ tab: 'encounters' }));
  useTabs.setState({ tab: loaded.data.tab === 'lorekeeper' ? 'lorekeeper' : 'encounters' });
  useTabs.subscribe((s) => {
    sharedDocuments.saveDocument(VIEW_DOC, { tab: s.tab }).catch(() => undefined);
  });
}
