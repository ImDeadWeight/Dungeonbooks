/**
 * @file Reads a campaign file and checks all of it before anything is
 * imported: the envelope, the campaign, its encounters (with Encounters'
 * reader, references included) and its notes (with the notes' reader, which
 * repairs what it can).
 */
import { fail, InvalidData, readInt, readObject, readOneOf, readString } from 'campaign-link/formats/read';
import { readTransferData } from '../encounters/domain/transfer/parseFile';
import { readCampaign } from '../encounters/domain/transfer/readEntities';
import { TRANSFER_APP, TRANSFER_VERSION } from '../encounters/domain/transfer/types';
import { readImageData } from '../lorekeeper/domain/imageExport';
import { readNotebookData } from '../lorekeeper/domain/library';
import { CAMPAIGN_FILE_APP, CAMPAIGN_FILE_KINDS, CAMPAIGN_FILE_VERSION, type CampaignFile } from './campaignFile';

/** Files larger than this (characters) are refused outright; pictures make campaign files big. */
const MAX_FILE_CHARS = 300_000_000;

/** The file read, or a readable reason it can't be imported. */
export type CampaignFileResult = { ok: true; file: CampaignFile } | { ok: false; error: string };

/** Reads the parsed JSON of a file whose `app` is Dungeon Books. */
export function readCampaignFile(json: unknown): CampaignFileResult {
  try {
    const o = readObject(json, 'file');
    if (o.app !== CAMPAIGN_FILE_APP) fail('file', 'is not a Dungeon Books file');
    const version = readInt(o.schemaVersion, 'schemaVersion', 1, Number.MAX_SAFE_INTEGER);
    if (version > CAMPAIGN_FILE_VERSION) fail('file', 'was made by a newer version of Dungeon Books; update the app to import it');
    readOneOf(o.kind, 'kind', CAMPAIGN_FILE_KINDS);
    const exportedAt = readString(o.exportedAt, 'exportedAt', 64);
    const campaign = readCampaign(o.campaign, 'campaign');
    const data = readTransferData('campaign', { ...readObject(o.encounters, 'encounters'), campaigns: [campaign] });
    let notes;
    try {
      notes = readNotebookData(o.notes);
    } catch (err) {
      fail('notes', (err as Error).message);
    }
    return {
      ok: true,
      file: {
        exportedAt,
        campaign,
        encounters: { app: TRANSFER_APP, schemaVersion: TRANSFER_VERSION, kind: 'campaign', exportedAt, data },
        notes,
        images: readImageData(o.images),
      },
    };
  } catch (err) {
    if (err instanceof InvalidData) return { ok: false, error: err.message };
    throw err;
  }
}

/** Reads a campaign file's text. */
export function parseCampaignFile(text: string): CampaignFileResult {
  if (text.length > MAX_FILE_CHARS) return { ok: false, error: 'the file is too large' };
  try {
    return readCampaignFile(JSON.parse(text));
  } catch (err) {
    if (err instanceof SyntaxError) return { ok: false, error: 'the file is not valid JSON' };
    throw err;
  }
}
