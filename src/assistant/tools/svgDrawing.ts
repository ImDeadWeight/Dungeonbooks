/**
 * @file Checking an SVG drawing an AI sends (one <svg> of sensible size, with
 * a viewBox or a width and height) and sizing it for turning into a picture:
 * the long side is drawn at RENDER_SIDE pixels, so it stays sharp when
 * zoomed as a map.
 */
import { ToolError } from './types';

/** Longest side of the picture made from a drawing (px). */
export const RENDER_SIDE = 2048;
/** Largest drawing taken (characters). */
const MAX_LENGTH = 2_000_000;

/** A drawing ready to render: its text with a pixel width and height set, and those sizes. */
export interface SizedSvg {
  svg: string;
  width: number;
  height: number;
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
/** "800", "800px" → 800; percentages and other units don't give a size. */
const pixels = (value: string | undefined) => (value && /^\s*[\d.]+\s*(px)?\s*$/i.test(value) ? parseFloat(value) : NaN);

/** The drawing checked and sized; a ToolError saying what to fix otherwise. */
export function sizeSvg(text: unknown, side = RENDER_SIDE): SizedSvg {
  if (typeof text !== 'string' || !text.trim()) throw new ToolError('svg must be the drawing as SVG text.');
  if (text.length > MAX_LENGTH) throw new ToolError('That drawing is too long (over 2 million characters).');
  const start = text.search(/<svg[\s>]/i);
  if (start < 0 || /<svg[\s>]/i.test(text.slice(start + 4))) throw new ToolError('svg must be one <svg> element (no nested <svg>).');
  const tagEnd = text.indexOf('>', start);
  const tag = text.slice(start, tagEnd);

  const box = attr(tag, 'viewBox')?.trim().split(/[\s,]+/).map(Number);
  let [w, h] = box?.length === 4 ? [box[2], box[3]] : [pixels(attr(tag, 'width')), pixels(attr(tag, 'height'))];
  if (!(w > 0) || !(h > 0)) throw new ToolError('Give the <svg> a viewBox (like viewBox="0 0 1600 1000"), or a width and height in pixels.');

  const scale = side / Math.max(w, h);
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);
  // Drawn at the picture's size: the viewBox (added from the old size if missing) scales the content.
  let rest = tag.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '');
  if (!box || box.length !== 4) rest += ` viewBox="0 0 ${w} ${h}"`;
  if (!/\sxmlns\s*=/.test(rest)) rest += ' xmlns="http://www.w3.org/2000/svg"';
  const svg = `${text.slice(0, start)}${rest} width="${width}" height="${height}"${text.slice(tagEnd)}`;
  return { svg, width, height };
}
