/**
 * @file Getting a picture an AI app wants on a page: from a file on this
 * computer (through the native side, which only reads image files), from a
 * web address, or as base64 it sends along. Whatever comes back must really
 * be a PNG, JPEG, WebP or GIF.
 */
import { invoke } from '@tauri-apps/api/core';
import { fromBase64 } from '../../lorekeeper/domain/imageExport';
import { sniffImageType } from '../../lorekeeper/domain/images';
import { isTauri } from '../../platform';
import { request } from '../models/http';
import { ToolError } from './types';

/** Largest picture taken (bytes); the native side has the same limit for files. */
const MAX_BYTES = 25 * 1024 * 1024;
/** How long a download may take (ms). */
const DOWNLOAD_TIMEOUT_MS = 30000;

async function fromPath(path: string): Promise<Uint8Array> {
  if (!isTauri()) throw new ToolError('Adding an image from a file works in the Dungeon Books app, not in a browser.');
  try {
    return new Uint8Array(await invoke<ArrayBuffer>('read_image_file', { path }));
  } catch (e) {
    throw new ToolError(typeof e === 'string' ? e : `Can't read that file: ${String(e)}`);
  }
}

async function fromUrl(url: string): Promise<Uint8Array> {
  if (!/^https?:\/\//i.test(url)) throw new ToolError('url must start with http:// or https://.');
  let response: Response;
  try {
    response = await request(url, { timeoutMs: DOWNLOAD_TIMEOUT_MS });
  } catch (e) {
    throw new ToolError(`Couldn't download ${url}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!response.ok) throw new ToolError(`Couldn't download ${url}: the server answered ${response.status}.`);
  const length = Number(response.headers.get('content-length'));
  if (length > MAX_BYTES) throw new ToolError('That image is larger than 25 MB.');
  return new Uint8Array(await response.arrayBuffer());
}

/** The picture the arguments point at (exactly one of path, url or data), checked to be an image. */
export async function loadImageArg(args: Record<string, unknown>): Promise<Blob> {
  const { path, url, data } = args;
  const given = [path, url, data].filter((v) => typeof v === 'string' && v.trim());
  if (given.length !== 1) throw new ToolError('Give exactly one of path (a file on this computer), url (a web address) or data (base64).');
  let bytes: Uint8Array;
  if (typeof path === 'string' && path.trim()) bytes = await fromPath(path.trim());
  else if (typeof url === 'string' && url.trim()) bytes = await fromUrl(url.trim());
  else {
    try {
      bytes = fromBase64(String(data).replace(/^data:[^,]*,/, '').replace(/\s+/g, ''));
    } catch {
      throw new ToolError('data must be base64.');
    }
  }
  if (bytes.byteLength > MAX_BYTES) throw new ToolError('That image is larger than 25 MB.');
  const type = sniffImageType(bytes);
  if (!type) throw new ToolError('That isn’t a PNG, JPEG, WebP or GIF image.');
  return new Blob([bytes.slice()], { type });
}
