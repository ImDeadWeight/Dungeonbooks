import { expect, test } from '@playwright/test';
import { failOnPageErrors, showTab, startApp } from './support/app';

const library = {
  areas: [],
  encounters: [{ id: 'e1', name: 'Goblin ambush', campaignId: 'c1', areaId: null, formatId: 'dnd5e', combatants: [], combat: { active: false, round: 0, currentId: null } }],
};

test('build a fight from SRD creatures and see how hard it is', async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await startApp(page, { library, campaign: { party: { size: 4, level: 1 } }, tab: 'encounters' });
  await showTab(page, 'Encounters');
  await page.locator('.sidebar:visible').getByText('Goblin ambush').click();
  await page.getByTitle('Add characters').click();

  await page.getByRole('tab', { name: 'SRD creatures' }).click();
  await page.locator('.compendium').getByPlaceholder('Search by name').fill('goblin');
  const goblin = page.locator('.compendium-row').filter({ has: page.locator('.name', { hasText: /^Goblin$/ }) });
  await goblin.getByTitle('Show stat block').click();
  await expect(goblin).toContainText('Armor Class 15 (leather armor, shield)');
  await expect(goblin).toContainText('passive Perception 9');
  await expect(goblin).not.toContainText('passive Perception 9, passive Perception 9');

  await goblin.getByTitle('Add to encounter').click();
  await page.locator('input[type=number]:focus').fill('4');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  // Four goblins (50 XP each) against the campaign's party of four at level 1.
  await expect(page.locator('.cart .difficulty-badge')).toHaveText('Low · 200 XP');

  await page.locator('button.primary', { hasText: 'Add to encounter' }).click();
  await expect(page.locator('.encounter-header .difficulty-badge')).toHaveText('Low · 200 XP');
  await expect(page.locator('.combatant-name', { hasText: 'Goblin' })).toHaveCount(4);
  noErrors();
});

test('copy an SRD creature into the character library', async ({ page }) => {
  await startApp(page, { tab: 'encounters' });
  await showTab(page, 'Encounters');
  await page.getByRole('button', { name: 'Characters' }).click();
  await page.getByRole('button', { name: 'From the SRD' }).click();
  // The library's own search sits underneath; use the compendium's.
  await page.locator('.compendium').getByPlaceholder('Search by name').fill('owlbear');
  await page.locator('.compendium-row', { hasText: 'Owlbear' }).getByTitle('Copy to your characters').click();
  await expect(page.locator('.compendium-row', { hasText: 'Owlbear' }).getByTitle('Edit your copy')).toBeVisible();
});
