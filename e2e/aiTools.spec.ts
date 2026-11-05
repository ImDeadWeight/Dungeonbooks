import { expect, test } from '@playwright/test';
import { callTool, failOnPageErrors, openPage, pngBase64, startApp, toolText } from './support/app';

const pages = [
  { id: 'atlas', title: 'Atlas', folderId: null, boxes: [] },
  { id: 'vault', title: 'Vaultrock', folderId: null, boxes: [] },
];

const islandSvg = (sea: string) => `<svg viewBox="0 0 1600 1000">
  <script>document.title = 'SCRIPT RAN'</script>
  <rect width="1600" height="1000" fill="${sea}"/>
  <path d="M220 260 C 420 120, 760 140, 980 250 S 1380 420, 1320 640 S 900 900, 620 820 S 160 620, 220 260 Z" fill="#c9b27c"/>
  <text x="1070" y="530" font-size="44">Vaultrock</text>
</svg>`;

test('AI apps see every tool', async ({ page }) => {
  await startApp(page, { pages });
  const names = await page.evaluate(async () => {
    const modulePath = '/src/assistant/mcpServer.ts';
    const { handleMcpBody } = await import(/* @vite-ignore */ modulePath);
    return JSON.parse(await handleMcpBody(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), 'e2e')).result.tools.map((t: { name: string }) => t.name);
  });
  for (const name of ['read_page', 'add_image', 'draw_image', 'view_image', 'add_pin', 'list_encounters', 'search_creatures', 'rate_encounter']) {
    expect(names).toContain(name);
  }
});

test('add an image as base64, pin a page, and look at it as a picture', async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await startApp(page, { pages });
  await openPage(page, 'Atlas');

  expect(await toolText(page, 'add_image', { page: 'Atlas', data: await pngBase64(page, 1200, 800), caption: 'The Veil' })).toBe('Added image 1 to "Atlas".');
  await expect(page.locator('.image-box img')).toBeVisible();
  expect(await toolText(page, 'add_pin', { page: 'Atlas', x: 0.7, y: 0.5, pin_page: 'Vaultrock' })).toContain('(pin 1)');
  expect(await toolText(page, 'read_page', { page: 'Atlas' })).toContain('Image 1: "The Veil", a map with pins for Vaultrock');

  const view = await callTool(page, 'view_image', { page: 'Atlas' });
  expect(view.isError).toBe(false);
  expect(view.content[0]).toMatchObject({ type: 'image', mimeType: 'image/jpeg' });
  expect(view.content[1]).toMatchObject({ type: 'text', text: expect.stringContaining('1. Vaultrock at (0.70, 0.50)') });
  noErrors();
});

test('draw a map from SVG without running its scripts, and redraw it keeping its pins', async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await startApp(page, { pages });
  await openPage(page, 'Atlas');

  expect(await toolText(page, 'draw_image', { page: 'Atlas', svg: islandSvg('#2f6fb0'), caption: 'The Veilstrand' })).toBe('Added image 1 to "Atlas".');
  await toolText(page, 'add_pin', { page: 'Atlas', x: 0.65, y: 0.52, pin_page: 'Vaultrock' });
  expect(await toolText(page, 'draw_image', { page: 'Atlas', image: 1, svg: islandSvg('#1f8a7a') })).toBe('Redrew image 1 on "Atlas"; its pin stays where it was.');
  expect(await toolText(page, 'view_image', { page: 'Atlas' })).toContain('(2048×1280 px)');
  expect(await page.title()).toBe('Dungeon Books');

  const bad = await callTool(page, 'draw_image', { page: 'Atlas', svg: '<svg viewBox="0 0 10 10"><unclosed></svg>' });
  expect(bad.isError).toBe(true);
  noErrors();
});

test('refuses what isn\u2019t an image, and file paths outside the desktop app', async ({ page }) => {
  await startApp(page, { pages });
  const notImage = await callTool(page, 'add_image', { page: 'Atlas', url: 'http://localhost:1440/app-icon.svg' });
  expect(notImage).toMatchObject({ isError: true, content: [{ text: 'That isn\u2019t a PNG, JPEG, WebP or GIF image.' }] });
  const path = await callTool(page, 'add_image', { page: 'Atlas', path: 'C:\\Maps\\world.png' });
  expect(path.isError).toBe(true);
});

test('encounter tools: search and read SRD creatures, rate a planned fight', async ({ page }) => {
  await startApp(page, { pages, campaign: { party: { size: 4, level: 2 } } });
  expect(await toolText(page, 'search_creatures', { query: 'goblin' })).toBe(
    '5e (2014) creatures:\n- Goblin (SRD, CR 1/4, humanoid; AC 15, HP 7)\n- Hobgoblin (SRD, CR 1/2, humanoid; AC 18, HP 11)',
  );
  expect(await toolText(page, 'read_creature', { creature: 'Goblin' })).toContain('Armor Class 15 (leather armor, shield)');
  expect(await toolText(page, 'rate_encounter', { foes: [{ creature: 'Goblin', count: 4 }, { creature: 'Hobgoblin' }] })).toContain(
    'Difficulty: Low (300 XP; Low up to 400, Moderate up to 600, High up to 800)',
  );
  expect(await toolText(page, 'list_encounters')).toBe('"Veilstrand" has no encounters yet.');
});
