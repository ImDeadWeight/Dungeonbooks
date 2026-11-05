/**
 * @file Turning an SVG drawing into a PNG picture, in the web view. The
 * drawing is loaded as an image, so nothing in it runs (no scripts) and it
 * fetches nothing; what can't be drawn that way fails with a message for
 * the AI.
 */
import { sizeSvg } from './svgDrawing';
import { ToolError } from './types';

/** The drawing as a PNG, its long side RENDER_SIDE px. */
export async function svgToPng(text: unknown): Promise<Blob> {
  const { svg, width, height } = sizeSvg(text);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode().catch(() => {
      throw new ToolError('That SVG can’t be drawn; check that it is well-formed XML with one <svg> root.');
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new ToolError('The drawing couldn’t be turned into a picture.');
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}
