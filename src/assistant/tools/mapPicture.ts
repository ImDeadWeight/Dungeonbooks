/**
 * @file A map as an AI sees it: the picture scaled to a size models handle
 * well, with a labelled grid every 0.1 (so it can name spots as x and y
 * fractions) and the pins drawn as numbered markers.
 */
import { useCampaigns } from '../../campaigns/campaignStore';
import { imageMime } from '../../lorekeeper/domain/images';
import type { ImageBox } from '../../lorekeeper/domain/notebook';
import { imageBytes } from '../../lorekeeper/state/imageFiles';
import { toBase64 } from '../../lorekeeper/domain/imageExport';
import { ToolError, type ToolImage } from './types';

/** Longest side sent (px): about what vision models see at full detail. */
const MAX_SIDE = 1568;
const GRID_STEPS = 10;

function drawGrid(g: CanvasRenderingContext2D, width: number, height: number, font: number) {
  g.lineWidth = 1;
  g.font = `${font}px sans-serif`;
  g.textBaseline = 'top';
  for (let i = 1; i < GRID_STEPS; i++) {
    const x = Math.round((width * i) / GRID_STEPS) + 0.5;
    const y = Math.round((height * i) / GRID_STEPS) + 0.5;
    // Dark under light, so the lines show on any picture.
    for (const [style, offset] of [['rgba(0,0,0,0.55)', 1], ['rgba(255,255,255,0.7)', 0]] as const) {
      g.strokeStyle = style;
      g.beginPath();
      g.moveTo(x + offset, 0);
      g.lineTo(x + offset, height);
      g.moveTo(0, y + offset);
      g.lineTo(width, y + offset);
      g.stroke();
    }
    const label = (i / GRID_STEPS).toFixed(1);
    for (const [text, lx, ly] of [[label, x + 3, 3], [label, 3, y + 3]] as const) {
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(lx - 2, ly - 1, g.measureText(text).width + 4, font + 2);
      g.fillStyle = '#fff';
      g.fillText(text, lx, ly);
    }
  }
}

function drawPins(g: CanvasRenderingContext2D, pins: { x: number; y: number }[], width: number, height: number, font: number) {
  const r = font * 0.9;
  g.font = `bold ${font}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  pins.forEach((pin, i) => {
    const x = pin.x * width;
    const y = pin.y * height;
    g.fillStyle = '#c93c3c';
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    g.fillText(String(i + 1), x, y + 1);
  });
}

/** The open campaign's image as a JPEG for a model, with the grid (unless `grid` is false) and numbered pins. */
export async function mapPicture(image: ImageBox, grid: boolean): Promise<{ picture: ToolImage; width: number; height: number }> {
  const campaignId = useCampaigns.getState().activeId;
  const bytes = campaignId ? await imageBytes(campaignId, image.imageId) : null;
  if (!bytes) throw new ToolError('The image file is missing, so it can’t be shown.');
  const bitmap = await createImageBitmap(new Blob([bytes.slice()], { type: imageMime(image.imageId) }));
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext('2d')!;
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const font = Math.max(12, Math.round(Math.max(canvas.width, canvas.height) / 70));
  if (grid) drawGrid(g, canvas.width, canvas.height, font);
  drawPins(g, image.pins ?? [], canvas.width, canvas.height, font);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new ToolError('The image couldn’t be drawn.');
  return { picture: { data: toBase64(new Uint8Array(await blob.arrayBuffer())), mimeType: 'image/jpeg' }, width: bitmap.width, height: bitmap.height };
}
