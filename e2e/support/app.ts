/**
 * @file Helpers for the end-to-end tests: starting the app on seeded data
 * (the browser version keeps documents in localStorage), moving around it,
 * and calling AI tools through the app's own MCP handler, as Claude Desktop
 * would.
 */
import { expect, type Page } from '@playwright/test';

/** A saved document, as the app writes it. */
const doc = (data: unknown) => JSON.stringify({ version: 1, data });

/** A text box holding one paragraph; `[text, pageId]` pieces are links. */
export function textBox(id: string, y: number, ...pieces: (string | [string, string])[]) {
  const content = pieces.map((p) =>
    typeof p === 'string' ? { type: 'text', text: p } : { type: 'text', text: p[0], marks: [{ type: 'pageLink', attrs: { pageId: p[1] } }] },
  );
  return { id, x: 40, y, width: 420, content: { type: 'doc', content: [{ type: 'paragraph', content }] } };
}

export interface Seed {
  /** Lorekeeper pages of the campaign. */
  pages?: object[];
  /** Encounters tab: areas and encounters. */
  library?: { areas: object[]; encounters: object[] };
  characters?: object[];
  /** Campaign settings beyond its id and name. */
  campaign?: { formatId?: string | null; party?: { size: number; level: number } };
  tab?: 'encounters' | 'lorekeeper' | 'assistant';
}

/** Opens the app on exactly this data (campaign "c1", "Veilstrand"). */
export async function startApp(page: Page, seed: Seed = {}) {
  const data: Record<string, string> = {
    'dungeon-books:shared:campaigns': doc({ campaigns: [{ id: 'c1', name: 'Veilstrand', formatId: 'dnd5e', ...seed.campaign }], activeId: 'c1' }),
    'dungeon-books:shared:view': doc({ tab: seed.tab ?? 'lorekeeper' }),
    'dungeon-books:lorekeeper:notebook-c1': doc({ format: 2, folders: [], pages: seed.pages ?? [] }),
    'dungeon-books:encounters:library': doc(seed.library ?? { areas: [], encounters: [] }),
    'dungeon-books:encounters:characters': doc({ templates: seed.characters ?? [], tags: [] }),
  };
  await page.goto('/');
  await page.evaluate((entries) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
  }, data);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Lorekeeper' })).toBeVisible();
}

export const showTab = (page: Page, name: 'Encounters' | 'Lorekeeper' | 'Assistant') => page.getByRole('tab', { name }).click();

/** Opens a Lorekeeper page from the sidebar. */
export async function openPage(page: Page, title: string) {
  // Every tab stays mounted; only the showing one's sidebar is visible.
  await page.locator('.sidebar:visible').getByText(title, { exact: true }).click();
  await expect(page.locator('.page-title')).toHaveValue(title);
}

/** What an AI tool call returns over MCP. */
export interface ToolResult {
  isError: boolean;
  content: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[];
}

/** Calls an AI tool the way an AI app does (through the app's MCP handler). */
export async function callTool(page: Page, name: string, args: object = {}): Promise<ToolResult> {
  return page.evaluate(
    async ([name, args]) => {
      const modulePath = '/src/assistant/mcpServer.ts';
      const { handleMcpBody } = await import(/* @vite-ignore */ modulePath);
      const body = await handleMcpBody(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }), 'e2e');
      return JSON.parse(body).result;
    },
    [name, args] as const,
  );
}

/** The text of a tool call's result. */
export async function toolText(page: Page, name: string, args: object = {}): Promise<string> {
  const result = await callTool(page, name, args);
  return result.content.flatMap((c) => (c.type === 'text' ? [c.text] : [])).join('\n');
}

/** A PNG of a plain picture (a lake on land), as base64, drawn in the page. */
export function pngBase64(page: Page, width = 800, height = 500): Promise<string> {
  return page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#2b5a3a';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#3b7bd0';
      g.beginPath();
      g.ellipse(w * 0.7, h * 0.5, w * 0.2, h * 0.2, 0, 0, 7);
      g.fill();
      return canvas.toDataURL('image/png').split(',')[1];
    },
    [width, height] as const,
  );
}

/** Fails the test if the page threw. Call at the start of a test. */
export function failOnPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return () => expect(errors, 'errors thrown in the page').toEqual([]);
}
