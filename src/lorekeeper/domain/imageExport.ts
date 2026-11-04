/**
 * @file Images in notebook files: reading a page's image boxes (and their
 * pins) safely, and carrying the pictures themselves inside an export as
 * base64, so an exported notebook stays one file.
 */
import { clampFraction, isImageId } from './images';
import type { ImageBox, MapPin } from './notebook';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function readPin(raw: unknown): MapPin | null {
  if (!isObject(raw) || !isString(raw.id) || !isString(raw.pageId) || !isNumber(raw.x) || !isNumber(raw.y)) return null;
  return { id: raw.id, x: clampFraction(raw.x), y: clampFraction(raw.y), pageId: raw.pageId };
}

/** A page's image boxes; damaged ones (or ones naming an image badly) are left out. Pins to missing pages stay (they show as broken). */
export function readImageBoxes(raw: unknown): ImageBox[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): ImageBox[] => {
    if (!isObject(r) || !isString(r.id) || !isImageId(r.imageId)) return [];
    const pins = Array.isArray(r.pins) ? r.pins.map(readPin).filter((p): p is MapPin => p !== null) : [];
    return [
      {
        id: r.id,
        x: isNumber(r.x) ? Math.max(0, r.x) : 0,
        y: isNumber(r.y) ? Math.max(0, r.y) : 0,
        width: isNumber(r.width) && r.width > 0 ? r.width : 480,
        imageId: r.imageId,
        ...(isString(r.caption) ? { caption: r.caption } : {}),
        ...(pins.length ? { pins } : {}),
      },
    ];
  });
}

/** Pictures by image id, as base64; what an export carries. */
export type ImageData = Record<string, string>;

/** The pictures in an export, keeping only well-formed ids and text. */
export function readImageData(raw: unknown): ImageData {
  if (!isObject(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter((e): e is [string, string] => isImageId(e[0]) && typeof e[1] === 'string'));
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  // In chunks: spreading a whole large image into one call overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
