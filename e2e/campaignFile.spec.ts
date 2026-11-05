import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { failOnPageErrors, openPage, showTab, startApp, textBox } from './support/app';

/** Veilstrand: two pages (one links to an encounter), an area with that encounter, and Mira made from her page. */
const veilstrand = {
  campaign: { party: { size: 4, level: 3 } },
  pages: [
    { id: 'p-mira', title: 'Mira Thorne', folderId: null, info: { type: 'character', kind: 'npc' }, boxes: [textBox('b1', 40, 'A smuggler.')] },
    {
      id: 'p-docks', title: 'The docks', folderId: null,
      boxes: [{ id: 'b2', x: 40, y: 40, width: 420, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fight: ' }, { type: 'encounterLink', attrs: { encounterId: 'e1', name: 'Dock brawl' } }] }] } }],
    },
  ],
  library: {
    areas: [{ id: 'a1', name: 'Harbour', campaignId: 'c1', parentAreaId: null }],
    encounters: [{ id: 'e1', name: 'Dock brawl', campaignId: 'c1', areaId: 'a1', formatId: 'dnd5e', combatants: [], combat: { active: false, round: 0, currentId: null } }],
  },
  characters: [{ id: 'mira', name: 'Mira Thorne', kind: 'npc', formatId: 'dnd5e', tagIds: [], deathSaves: false, statBlock: null, lore: { notebookId: 'c1', pageId: 'p-mira' } }],
};

/** Export this campaign from the campaign menu; resolves to the saved file's name and text. */
async function exportOpenCampaign(page: Page) {
  await page.locator('.campaign-current:visible').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export this campaign…' }).click();
  const file = await download;
  return { name: file.suggestedFilename(), text: await readFile((await file.path())!, 'utf8') };
}

/** Import (in the showing tab's top bar) with this file. */
async function importText(page: Page, name: string, text: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.top-bar-import:visible').click();
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
}

test('export the open campaign as one file and bring it in whole on another device', async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await startApp(page, veilstrand);
  const file = await exportOpenCampaign(page);
  expect(file.name).toBe('Veilstrand.dungeonbooks.json');
  const json = JSON.parse(file.text);
  expect(json).toMatchObject({ app: 'dungeon-books', schemaVersion: 1, kind: 'campaign', campaign: { id: 'c1', party: { size: 4, level: 3 } } });
  expect(json.notes.pages.map((p: { title: string }) => p.title)).toEqual(['Mira Thorne', 'The docks']);
  expect(json.encounters.encounters.map((e: { name: string }) => e.name)).toEqual(['Dock brawl']);
  expect(json.encounters.templates.map((t: { name: string }) => t.name)).toEqual(['Mira Thorne']);

  // Another device, with only its own campaign.
  await startApp(page, { campaign: { id: 'c2', name: 'Elsewhere' } });
  await importText(page, file.name, file.text);
  await expect(page.locator('.modal')).toContainText('A new campaign');
  await page.locator('.modal').getByRole('button', { name: 'Import', exact: true }).click();

  await expect(page.locator('.campaign-current:visible')).toContainText('Veilstrand');
  await openPage(page, 'The docks');
  // The link finds its encounter (it shows the encounter's state).
  await expect(page.locator('.encounter-chip')).toHaveText('Dock brawlNot in combat');
  await showTab(page, 'Encounters');
  await expect(page.locator('.sidebar:visible')).toContainText('Harbour');
  await expect(page.locator('.sidebar:visible')).toContainText('Dock brawl');
  noErrors();
});

test('a campaign already here: its notes go with the choice made for it', async ({ page }) => {
  await startApp(page, veilstrand);
  const file = await exportOpenCampaign(page);
  // The notes here change after the export.
  await openPage(page, 'Mira Thorne');
  await page.locator('.page-title').fill('Mira the Spy');
  await page.locator('.page-title').press('Enter');

  await importText(page, file.name, file.text);
  const dialog = page.locator('.modal');
  await expect(dialog).toContainText('This campaign is already here.');
  await expect(dialog).toContainText("The notes here stay as they are; the file's notes aren't imported.");
  await dialog.getByRole('radio', { name: 'Keep both' }).click();
  await expect(dialog).toContainText("The copy gets the file's notes");
  await dialog.getByRole('button', { name: 'Import', exact: true }).click();

  // The copy opens, with the file's notes; the original keeps its own.
  await expect(page.locator('.campaign-current:visible')).toContainText('Veilstrand (imported)');
  await expect(page.locator('.sidebar:visible')).toContainText('Mira Thorne');
  await page.locator('.campaign-current:visible').click();
  await page.locator('.campaign-row', { hasText: /^Veilstrand$/ }).click();
  await expect(page.locator('.sidebar:visible')).toContainText('Mira the Spy');
});

test('Import still takes Encounters exports and Lorekeeper notes', async ({ page }) => {
  await startApp(page);
  const encounters = { app: 'encounters', schemaVersion: 2, kind: 'campaign', exportedAt: new Date().toISOString(), data: { campaigns: [{ id: 'c9', name: 'Old fights', formatId: null }], areas: [], encounters: [], templates: [], tags: [], customConditions: [] } };
  await importText(page, 'Old fights.encounters.json', JSON.stringify(encounters));
  await expect(page.getByRole('tab', { name: 'Encounters' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.modal')).toContainText('Import campaign');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await showTab(page, 'Lorekeeper');
  const notes = { format: 'lorekeeper-notebook', version: 1, name: 'Old notes', notebook: { folders: [], pages: [{ id: 'p1', title: 'Harbour', folderId: null, boxes: [] }] } };
  await importText(page, 'Old notes.json', JSON.stringify(notes));
  // The open campaign has no notes, so they fill it.
  await expect(page.locator('.sidebar:visible')).toContainText('Harbour');
});
