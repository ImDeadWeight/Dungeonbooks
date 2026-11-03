/**
 * @file First start on Windows: copies the separate Encounters and
 * Lorekeeper apps' data in, along with the links between their campaigns and
 * notebooks. Ids are kept, so characters still point at their pages. Runs
 * once, and only while this app has no data of its own; the old apps' files
 * are only read, so they go on working with their own copies.
 *
 * Android keeps each app's files private, so there the old data comes over
 * with each tab's Import instead.
 */
import { sharedDocuments } from '../bridge/sharedDocuments';
import { ENCOUNTERS_FOLDER } from '../encounters/storage/documents';
import { LOREKEEPER_FOLDER } from '../lorekeeper/storage/documents';
import { isMobile, isTauri } from '../platform';
import { createDocuments, type Documents } from '../storage/documents';
import { envelopeData, OLD_APPS, readOldDocument } from './oldAppFiles';
import { linksFromClaims, OLD_LINKS_DOC, type OldClaims } from './oldLinks';

/** Shared document recording that the copy was done (or wasn't needed), so it never runs twice. */
const MARKER_DOC = 'copied-from-old-apps';
/** Each old app's link claims. */
const CLAIMS_DOC = 'campaign-link';
/** Encounters' documents. */
const ENCOUNTERS_DOCS = ['library', 'characters', 'conditions'];
/** Lorekeeper's documents besides one per notebook ("notebook" predates having several). */
const LOREKEEPER_DOCS = ['library', 'view', 'notebook'];

/** Copies an old app's documents into `docs`; resolves to the names copied. */
async function copyDocuments(app: keyof typeof OLD_APPS, names: string[], docs: Documents): Promise<string[]> {
  const copied: string[] = [];
  for (const name of names) {
    const text = await readOldDocument(app, name);
    if (text === null) continue;
    await docs.saveRawDocument(name, text);
    copied.push(name);
  }
  return copied;
}

/** The notebooks in Lorekeeper's saved library, as their document names. */
function notebookDocs(libraryText: string | null): string[] {
  const notebooks = envelopeData(libraryText)?.notebooks;
  if (!Array.isArray(notebooks)) return [];
  return notebooks.map((n) => (n as { id?: unknown }).id).filter((id): id is string => typeof id === 'string').map((id) => `notebook-${id}`);
}

/** An old app's saved link claims. */
async function oldClaims(app: keyof typeof OLD_APPS): Promise<OldClaims> {
  const claims = envelopeData(await readOldDocument(app, CLAIMS_DOC))?.claims;
  return typeof claims === 'object' && claims !== null ? (claims as OldClaims) : {};
}

/**
 * Copies the old apps' data the first time this app starts on Windows.
 * Resolves to a message for the user when something was copied, else null.
 * Call before the tabs load their data.
 */
export async function copyOldApps(): Promise<string | null> {
  if (!isTauri() || isMobile()) return null;
  if (await sharedDocuments.hasDocument(MARKER_DOC)) return null;

  const encounters = createDocuments(ENCOUNTERS_FOLDER);
  const lorekeeper = createDocuments(LOREKEEPER_FOLDER);
  // Never copy over data made here (e.g. if the marker was deleted).
  const fresh = !(await encounters.hasDocument('library')) && !(await lorekeeper.hasDocument('library'));
  const copiedEncounters = fresh ? await copyDocuments('encounters', ENCOUNTERS_DOCS, encounters) : [];
  const copiedLorekeeper = fresh
    ? await copyDocuments('lorekeeper', [...LOREKEEPER_DOCS, ...notebookDocs(await readOldDocument('lorekeeper', 'library'))], lorekeeper)
    : [];

  let linkCount = 0;
  if (copiedEncounters.length > 0 && copiedLorekeeper.length > 0) {
    const links = linksFromClaims(await oldClaims('encounters'), await oldClaims('lorekeeper'));
    linkCount = Object.keys(links).length;
    await sharedDocuments.saveDocument(OLD_LINKS_DOC, { notebookByCampaign: links });
  }

  await sharedDocuments.saveDocument(MARKER_DOC, {
    copiedAt: new Date().toISOString(),
    encounters: copiedEncounters,
    lorekeeper: copiedLorekeeper,
  });

  const parts = [
    copiedEncounters.length > 0 && 'your Encounters campaigns and characters',
    copiedLorekeeper.length > 0 && 'your Lorekeeper notebooks',
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const linked = linkCount > 0 ? ` and ${linkCount === 1 ? 'the link' : `${linkCount} links`} between them` : '';
  return `Copied ${parts.join(' and ')}${linked}. The separate apps keep their own copies.`;
}
