import { expect, test } from '@playwright/test';
import { failOnPageErrors, openPage, pngBase64, startApp } from './support/app';

const pages = [
  { id: 'atlas', title: 'Atlas', folderId: null, boxes: [] },
  { id: 'mira', title: 'Mira Thorne', folderId: null, boxes: [] },
];

test('add an image, caption it, open it as a map and pin a page on it', async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await startApp(page, { pages });
  await openPage(page, 'Atlas');

  const png = await pngBase64(page);
  await page.getByTitle('More for this page').click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Add image…').click();
  await (await chooser).setFiles({ name: 'map.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });

  const box = page.locator('.image-box');
  await expect(box.locator('img')).toBeVisible();
  await box.hover();
  await box.locator('.image-caption').fill('The Veil');

  await box.getByTitle('Open as a map (pin pages on it)').click();
  const frame = page.locator('.map-frame');
  await expect(frame.locator('img')).toBeVisible();
  await expect(page.locator('.map-header')).toContainText('The Veil');
  const area = (await frame.boundingBox())!;
  await page.mouse.click(area.x + area.width * 0.35, area.y + area.height * 0.45);
  await page.getByPlaceholder('Pin which page?').fill('mira');
  await page.keyboard.press('Enter');
  await expect(frame.locator('.map-pin')).toHaveText('Mira Thorne');

  // Pins count as links.
  await page.getByTitle('Back to the page').click();
  await expect(box.locator('.image-pin')).toHaveCount(1);
  await openPage(page, 'Mira Thorne');
  await page.getByRole('button', { name: 'Linked from 1 page' }).click();
  await expect(page.locator('.backlink')).toContainText('Pinned on the map "The Veil"');
  noErrors();
});

test('a pin’s menu peeks at its page and removes the pin', async ({ page }) => {
  await startApp(page, { pages });
  await openPage(page, 'Atlas');
  const png = await pngBase64(page);
  await page.evaluate(async (data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const actions = '/src/lorekeeper/state/imageActions.ts';
    const { addImages, addPin } = await import(/* @vite-ignore */ actions);
    const store = '/src/lorekeeper/state/notebookStore.ts';
    const { useNotebook } = await import(/* @vite-ignore */ store);
    await addImages('atlas', [new Blob([bytes], { type: 'image/png' })], 40, 40);
    const image = useNotebook.getState().pages.find((p: { id: string }) => p.id === 'atlas').images[0];
    addPin('atlas', image.id, { x: 0.5, y: 0.5, pageId: 'mira' });
  }, png);

  await page.locator('.image-frame').dblclick();
  await page.locator('.map-pin').click();
  await expect(page.locator('.pin-menu-title')).toHaveText('Mira Thorne');
  await page.locator('.pin-menu').getByRole('button', { name: 'Remove pin' }).click();
  await expect(page.locator('.map-pin')).toHaveCount(0);
});
