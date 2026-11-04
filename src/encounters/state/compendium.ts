/**
 * @file Loading a format's compendium (fetched from the app's own files the
 * first time it is shown, then kept), and copying its creatures into the
 * character library.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import { getFormat } from 'campaign-link/formats/registry';
import { useEffect, useState } from 'react';
import type { CharacterTemplate } from '../domain/characters';
import { COMPENDIUM_TAG, findCopy, templateFromEntry } from '../domain/compendium/fromCompendium';
import { COMPENDIUM_FILES, type CompendiumEntry, type CompendiumFile } from '../domain/compendium/types';
import { newId } from '../domain/ids';
import { useCharacters } from './characterStore';

const loaded = new Map<FormatId, Promise<CompendiumFile>>();

async function fetchCompendium(formatId: FormatId): Promise<CompendiumFile> {
  const name = COMPENDIUM_FILES[formatId];
  if (!name) throw new Error('This game system has no compendium.');
  const response = await fetch(`${import.meta.env.BASE_URL}compendium/${name}`);
  if (!response.ok) throw new Error(`Could not load the compendium (${response.status}).`);
  const file = (await response.json()) as CompendiumFile;
  if (file.format !== 'dungeon-books-compendium' || file.formatId !== formatId) throw new Error('The compendium file is not one this version reads.');
  // Checked as imported stat blocks are, so a bad file can't put a bad stat block in the library.
  const format = getFormat(formatId);
  return { ...file, entries: file.entries.map((e) => ({ ...e, statBlock: format.sanitizeStatBlock(e.statBlock, e.id) })) };
}

/** A format's compendium: loads once, shared by every caller. */
export function loadCompendium(formatId: FormatId): Promise<CompendiumFile> {
  let file = loaded.get(formatId);
  if (!file) {
    file = fetchCompendium(formatId);
    // A failed load is tried again next time.
    file.catch(() => loaded.delete(formatId));
    loaded.set(formatId, file);
  }
  return file;
}

/** The compendium while it loads (null), once loaded, or why it couldn't be. */
export function useCompendium(formatId: FormatId): CompendiumFile | null | { error: string } {
  const [state, setState] = useState<CompendiumFile | null | { error: string }>(null);
  useEffect(() => {
    let live = true;
    setState(null);
    loadCompendium(formatId).then(
      (file) => live && setState(file),
      (e: Error) => live && setState({ error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [formatId]);
  return state;
}

/** The library's copy of a creature, made (tagged SRD) the first time. */
export function libraryCopy(entry: CompendiumEntry, formatId: FormatId): CharacterTemplate {
  const store = useCharacters.getState();
  const existing = findCopy(store.templates, formatId, entry.id);
  if (existing) return existing;
  const template = templateFromEntry(entry, formatId, store.ensureTag(COMPENDIUM_TAG).id, newId());
  store.saveTemplate(template);
  return template;
}
