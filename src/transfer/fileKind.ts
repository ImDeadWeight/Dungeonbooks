/**
 * @file What a file the user wants to import is: a Dungeon Books campaign
 * file, an Encounters export (the Encounters app's, or Dungeon Books 0.3 and
 * earlier), or Lorekeeper notes (an exported or saved notebook).
 */
import { TRANSFER_APP } from '../encounters/domain/transfer/types';
import { CAMPAIGN_FILE_APP } from './campaignFile';

/** The kinds of file Import takes, or null when it is none of them. */
export type ImportFileKind = 'campaign' | 'encounters' | 'notes' | null;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Tells the kinds apart by their markers only; each kind's own reader checks the rest. */
export function importFileKind(json: unknown): ImportFileKind {
  if (!isObject(json)) return null;
  if (json.app === CAMPAIGN_FILE_APP) return 'campaign';
  if (json.app === TRANSFER_APP) return 'encounters';
  if (json.format === 'lorekeeper-notebook' || isObject(json.data)) return 'notes';
  return null;
}
