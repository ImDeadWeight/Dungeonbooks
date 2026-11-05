import { expect, test } from '@playwright/test';
import { failOnPageErrors, openPage, startApp, textBox } from './support/app';

const pages = [
  { id: 'vault', title: 'Vaultrock', folderId: null, boxes: [textBox('b1', 20, 'A fortress city over the mines.')], info: { type: 'place', parentPlaceId: null } },
  { id: 'mira', title: 'Mira Thorne', folderId: null, boxes: [textBox('b2', 20, 'Born in ', ['Vaultrock', 'vault'], '.')] },
  { id: 'storm', title: 'Everstorm', folderId: null, boxes: [textBox('b3', 20, 'Seen from Vaultrock on clear nights.')] },
];

test('a page lists who links to it and who mentions it, and links a mention', async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await startApp(page, { pages });
  await openPage(page, 'Vaultrock');

  const toggle = page.getByRole('button', { name: 'Linked from 1 page, mentioned in 1 page' });
  await toggle.click();
  const backlinks = page.locator('.backlinks');
  await expect(backlinks.locator('.backlink', { hasText: 'Mira Thorne' })).toContainText('Born in Vaultrock.');
  await expect(backlinks.locator('.backlink', { hasText: 'Everstorm' })).toContainText('Seen from Vaultrock on clear nights.');

  await backlinks.getByTitle('Link this mention').click();
  await expect(page.getByRole('button', { name: 'Linked from 2 pages' })).toBeVisible();
  noErrors();
});

test('the peek panel shows who links to a page', async ({ page }) => {
  await startApp(page, { pages });
  await openPage(page, 'Mira Thorne');
  await page.locator('a.page-link', { hasText: 'Vaultrock' }).click();
  await expect(page.locator('.peek-backlinks')).toContainText('Mira Thorne');
});
