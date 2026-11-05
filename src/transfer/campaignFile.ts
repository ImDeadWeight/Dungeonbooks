/**
 * @file The Dungeon Books campaign file: one campaign with everything in it,
 * both tabs' halves together (its encounters with the characters in them,
 * its notes with their pictures), so a campaign moves between devices whole
 * and its links between notes and encounters keep working.
 *
 * On disk (Name.dungeonbooks.json):
 *   { app: "dungeon-books", schemaVersion, kind: "campaign", exportedAt,
 *     campaign, encounters: { areas, encounters, templates, tags, customConditions },
 *     notes: { format, folders, pages }, images?: { <image id>: base64 } }
 * The encounters part is the same as an Encounters campaign export's data and
 * the notes part the same as a saved notebook, so both are read by the
 * readers those already have (see parseCampaignFile.ts).
 */
import type { Campaign } from '../campaigns/types';
import type { Bundle, TransferFile } from '../encounters/domain/transfer/types';
import type { ImageData } from '../lorekeeper/domain/imageExport';
import type { Notebook } from '../lorekeeper/domain/notebook';

/** Marks a JSON file as a Dungeon Books file. */
export const CAMPAIGN_FILE_APP = 'dungeon-books';
/** Current version; files from newer versions are refused. */
export const CAMPAIGN_FILE_VERSION = 1;
/** The kinds of Dungeon Books file (only campaigns so far). */
export const CAMPAIGN_FILE_KINDS = ['campaign'] as const;
/** File names end with this. */
export const CAMPAIGN_FILE_EXTENSION = 'dungeonbooks.json';

/** A campaign's encounters half, as the file stores it (its campaign is the file's). */
export type CampaignEncounters = Omit<Bundle, 'campaigns'>;

/** The JSON written to a campaign file. */
export interface CampaignFileJson {
  app: typeof CAMPAIGN_FILE_APP;
  schemaVersion: number;
  kind: (typeof CAMPAIGN_FILE_KINDS)[number];
  /** ISO timestamp, shown when importing. */
  exportedAt: string;
  campaign: Campaign;
  encounters: CampaignEncounters;
  notes: Notebook;
  /** The pictures its pages show, by image id (absent when there are none). */
  images?: ImageData;
}

/** A campaign file as read: its encounters in the form Encounters' import takes, its notes and pictures. */
export interface CampaignFile {
  exportedAt: string;
  campaign: Campaign;
  /** An Encounters campaign export of the same campaign, for planning and applying the encounters half. */
  encounters: TransferFile;
  notes: Notebook;
  images: ImageData;
}

/** The text of a campaign file. `bundle` is an Encounters campaign export of `campaign`. */
export function campaignFileText(campaign: Campaign, bundle: Bundle, notes: Notebook, images: ImageData, now = new Date()): string {
  const { campaigns: _campaign, ...encounters } = bundle;
  const file: CampaignFileJson = {
    app: CAMPAIGN_FILE_APP,
    schemaVersion: CAMPAIGN_FILE_VERSION,
    kind: 'campaign',
    exportedAt: now.toISOString(),
    campaign,
    encounters,
    notes,
    ...(Object.keys(images).length ? { images } : {}),
  };
  return JSON.stringify(file, null, 2);
}

/** A file name for a campaign, with characters Windows forbids removed. */
export function campaignFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const safe = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/[. ]+$/, '').trim().slice(0, 80);
  return `${safe || 'campaign'}.${CAMPAIGN_FILE_EXTENSION}`;
}
