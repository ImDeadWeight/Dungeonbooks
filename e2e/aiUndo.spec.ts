import { expect, test } from '@playwright/test';
import { failOnPageErrors, openPage, startApp, textBox, toolText } from './support/app';

const pages = [{ id: 'vault', title: 'Vaultrock', folderId: null, boxes: [textBox('b1', 20, 'A fortress city.')] }];

test('an AI app’s change shows a notice, and Undo puts the page back', async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await startApp(page, { pages });
  await openPage(page, 'Vaultrock');

  expect(await toolText(page, 'add_text', { page: 'Vaultrock', text: 'The Imperium built it.' })).toBe('Added text box 2 to "Vaultrock".');
  await expect(page.locator('.page-canvas')).toContainText('The Imperium built it.');
  const toast = page.locator('.ai-toast');
  await expect(toast).toContainText('An AI app: Add text to "Vaultrock"');

  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.page-canvas')).not.toContainText('The Imperium built it.');
  await expect(toast).toContainText('Undone');
  noErrors();
});

test('Settings lists AI changes, and asks before undoing one the user edited since', async ({ page }) => {
  await startApp(page, { pages });
  await openPage(page, 'Vaultrock');
  await toolText(page, 'update_page', { page: 'Vaultrock', title: 'Vaultrock Keep' });
  // The user renames it again afterwards.
  await page.locator('.page-title').fill('Vaultrock Citadel');

  await page.locator('button[title="Settings"]:visible').click();
  await page.getByRole('tab', { name: 'AI changes' }).click();
  const row = page.locator('.ai-changes li', { hasText: 'Change "Vaultrock"' });
  await row.getByRole('button', { name: 'Undo' }).click();
  await expect(row).toContainText('"Vaultrock Citadel" changed since; undoing loses that.');
  await row.getByRole('button', { name: 'Undo anyway' }).click();
  await expect(row).toContainText('Undone');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.page-title')).toHaveValue('Vaultrock');
});
