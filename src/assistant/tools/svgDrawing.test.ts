import { describe, expect, it } from 'vitest';
import { sizeSvg } from './svgDrawing';

describe('sizing an SVG drawing', () => {
  it('draws the long side at the render size, keeping the viewBox', () => {
    const { svg, width, height } = sizeSvg('<svg viewBox="0 0 1600 1000"><rect width="10" height="10"/></svg>', 2048);
    expect([width, height]).toEqual([2048, 1280]);
    expect(svg).toBe('<svg viewBox="0 0 1600 1000" xmlns="http://www.w3.org/2000/svg" width="2048" height="1280"><rect width="10" height="10"/></svg>');
  });

  it('turns a pixel width and height into a viewBox, and keeps what comes before the <svg>', () => {
    const { svg, width, height } = sizeSvg('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="400px" height="800"></svg>', 1000);
    expect([width, height]).toEqual([500, 1000]);
    expect(svg).toBe('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" width="500" height="1000"></svg>');
  });

  it('says what to fix', () => {
    expect(() => sizeSvg('')).toThrow('svg must be the drawing');
    expect(() => sizeSvg('<div>hi</div>')).toThrow('one <svg> element');
    expect(() => sizeSvg('<svg viewBox="0 0 10 10"><svg></svg></svg>')).toThrow('no nested');
    expect(() => sizeSvg('<svg width="100%" height="100%"></svg>')).toThrow('viewBox');
    expect(() => sizeSvg(`<svg viewBox="0 0 1 1">${'x'.repeat(2_000_001)}</svg>`)).toThrow('too long');
  });
});
