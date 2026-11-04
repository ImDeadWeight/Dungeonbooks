/**
 * @file What AI apps can do with the open campaign's notes: look around,
 * search, read pages as Markdown, make pages, add and replace text, change a
 * page's details, and link mentions. Every edit goes through the notebook
 * store, so it saves and shows on screen like the user's own. Pages are named
 * by title, alias or id. Nothing here deletes pages, folders or boxes, except
 * that replacing a box's text replaces what was in it.
 */
import type { JSONContent } from '@tiptap/core';
import { useCampaigns } from '../campaigns/campaignStore';
import { linkMentions } from '../lorekeeper/domain/autolink';
import type { Id } from '../lorekeeper/domain/ids';
import {
  byFolderOrder,
  byName,
  infoForType,
  PAGE_TYPES,
  pageType,
  parseAliases,
  placeParentOptions,
  type Folder,
  type Page,
  type PageInfo,
  type PageType,
  type TextBox,
} from '../lorekeeper/domain/notebook';
import { searchablePages, searchPages } from '../lorekeeper/domain/pageSearch';
import { createTitleMatcher, normalizeTitle } from '../lorekeeper/domain/titleMatcher';
import { useNotebook } from '../lorekeeper/state/notebookStore';
import { fromMarkdown, toMarkdown } from './markdown';
import { describeType, linkNames } from './notesMarkdown';

/** A mistake in what the AI asked for; the message goes back to it. */
export class ToolError extends Error {}

/** An action an AI app can take, described for it (name, what it does, its arguments as JSON Schema). */
export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  /** Only looks; changes nothing. */
  readOnly?: boolean;
  run(args: Record<string, unknown>): string;
}

// ---- Looking things up -------------------------------------------------------

const notebook = () => useNotebook.getState();

/** The page an argument names, or an error that suggests close names. */
function findPage(name: unknown): Page {
  if (typeof name !== 'string' || !name.trim()) throw new ToolError('Name the page by its title (or an alias, or its id).');
  const id = linkNames().pageNamed(name.trim());
  const page = id && notebook().pages.find((p) => p.id === id);
  if (page) return page;
  const close = searchPages(name, searchablePages(notebook().pages), { currentPageId: '', folderId: null, recentPageIds: [] }, 5);
  throw new ToolError(`No page is called "${name}".${close.length ? ` Close names: ${close.map((r) => `"${r.name}"`).join(', ')}.` : ''}`);
}

/** "Places/Cities" for a folder; '' for the top level. */
function folderPath(folders: Folder[], folderId: Id | null): string {
  const names: string[] = [];
  for (let id = folderId; id && names.length <= folders.length; ) {
    const folder = folders.find((f) => f.id === id);
    if (!folder) break;
    names.unshift(folder.name);
    id = folder.parentId;
  }
  return names.join('/');
}

/** The folder at a path like "Places/Cities" (any case), making any that are missing; null for the top level. */
function folderAt(path: unknown): Id | null {
  if (path === undefined || path === null) return null;
  if (typeof path !== 'string') throw new ToolError('folder must be a path like "Places/Cities".');
  let parentId: Id | null = null;
  for (const name of path.split('/').map((n) => n.trim()).filter(Boolean)) {
    const existing: Folder | undefined = notebook().folders.find((f) => f.parentId === parentId && normalizeTitle(f.name) === normalizeTitle(name));
    parentId = existing ? existing.id : notebook().addFolder(parentId, name);
  }
  return parentId;
}

/** A box's text as Markdown. */
const boxMarkdown = (box: TextBox) => toMarkdown(box.content, linkNames());

// ---- Changing things -----------------------------------------------------------

const PAGE_TYPE_IDS = PAGE_TYPES.map((t) => t.type);

/** Sets a page's type (and the type's own detail: PC/NPC, the place it is inside) from tool arguments. */
function applyType(page: Page, args: Record<string, unknown>) {
  const { type, character_kind: kind, inside_place: inside } = args;
  if (type === undefined && kind === undefined && inside === undefined) return;
  if (type !== undefined && !PAGE_TYPE_IDS.includes(type as PageType)) throw new ToolError(`type must be one of ${PAGE_TYPE_IDS.join(', ')}.`);
  let info: PageInfo | undefined = infoForType((type as PageType | undefined) ?? pageType(page), page.info);
  if (kind !== undefined) {
    if (info?.type !== 'character') throw new ToolError('character_kind only applies to character pages.');
    if (kind !== 'pc' && kind !== 'npc') throw new ToolError('character_kind must be "pc" or "npc".');
    info = { type: 'character', kind };
  }
  if (inside !== undefined) {
    if (info?.type !== 'place') throw new ToolError('inside_place only applies to place pages.');
    let parentPlaceId: Id | null = null;
    if (inside) {
      const parent = findPage(inside);
      if (!placeParentOptions(notebook().pages, page.id).some((p) => p.id === parent.id)) {
        throw new ToolError(`"${parent.title}" can't hold "${page.title}": it isn't a place page, or it is inside "${page.title}".`);
      }
      parentPlaceId = parent.id;
    }
    info = { type: 'place', parentPlaceId };
  }
  notebook().setPageInfo([page.id], () => info);
}

/** Aliases from tool arguments: a list of names. */
function aliasesArg(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) throw new ToolError('aliases must be a list of names.');
  return parseAliases(value.join(','));
}

/** Markdown text from tool arguments as a box document, with a note on [[links]] that match no page. */
function textArg(value: unknown): { doc: JSONContent; note: string } {
  if (typeof value !== 'string' || !value.trim()) throw new ToolError('text must be Markdown text.');
  const { doc, unknownLinks } = fromMarkdown(value, linkNames());
  const note = unknownLinks.length
    ? ` These [[links]] match no page and were left as plain text: ${unknownLinks.map((n) => `"${n}"`).join(', ')}. Create those pages first to link them.`
    : '';
  return { doc, note };
}

/** Rough height of a box on the canvas (px), to place a new box under the others. */
function boxHeight(box: TextBox): number {
  const charsPerLine = Math.max(20, box.width / 7.5);
  const lines = (box.content.content ?? []).reduce((sum, block) => sum + Math.max(1, Math.ceil(toMarkdown({ type: 'doc', content: [block] }, linkNames()).length / charsPerLine)), 0);
  return 40 + lines * 24;
}

/** Adds a box with this content under a page's other boxes; returns its number on the page. */
function addBoxBelow(page: Page, content: JSONContent): number {
  const x = page.boxes[0]?.x ?? 40;
  const y = page.boxes.length ? Math.max(...page.boxes.map((b) => b.y + boxHeight(b))) + 24 : 40;
  const id = notebook().addBox(page.id, x, y);
  notebook().setBoxContent(page.id, id, content);
  return page.boxes.length + 1;
}

/** Which box a tool means: its number, or the only one. */
function boxArg(page: Page, value: unknown): number {
  if (value === undefined && page.boxes.length === 1) return 1;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > page.boxes.length) {
    throw new ToolError(`box must be a text box number from 1 to ${page.boxes.length} (read_page shows them).`);
  }
  return value;
}

// ---- The tools ---------------------------------------------------------------

const PAGE_ARG = { type: 'string', description: 'The page: its title, one of its aliases, or its id.' };
const TEXT_ARG = {
  type: 'string',
  description:
    'Markdown: headings, paragraphs, **bold**, *italic*, lists, > quotes. Link to another page with [[Its Title]], or [[Its Title|the words to show]].',
};
const TYPE_ARGS = {
  type: { type: 'string', enum: PAGE_TYPE_IDS, description: 'What the page describes.' },
  character_kind: { type: 'string', enum: ['npc', 'pc'], description: 'Character pages: NPC or player character.' },
  inside_place: { type: 'string', description: 'Place pages: the place page it is inside ("" for none).' },
  aliases: { type: 'array', items: { type: 'string' }, description: 'Other names the page goes by; mentions of these link to it too. Replaces the current list.' },
};

export const NOTES_TOOLS: Tool[] = [
  {
    name: 'get_overview',
    title: 'Overview of the notes',
    description: "The open campaign's name and every folder and page in its notes, with each page's type and aliases. Start here.",
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
    run() {
      const { folders, pages } = notebook();
      const campaign = useCampaigns.getState().campaigns.find((c) => c.id === useCampaigns.getState().activeId);
      const lines = [`Campaign: ${campaign?.name ?? '(none open)'}`, `${pages.length} pages, ${folders.length} folders.`, ''];
      const describe = (p: Page) => {
        const aliases = p.aliases?.length ? `; also called ${p.aliases.join(', ')}` : '';
        const empty = p.boxes.length ? '' : '; empty';
        return `${p.title} (${describeType(p, pages)}${aliases}${empty})`;
      };
      const walk = (parentId: Id | null, indent: string) => {
        for (const f of folders.filter((f) => f.parentId === parentId).sort(byFolderOrder)) {
          lines.push(`${indent}${f.name}/`);
          walk(f.id, indent + '  ');
        }
        for (const p of pages.filter((p) => p.folderId === parentId).sort((a, b) => byName(a.title, b.title))) lines.push(`${indent}- ${describe(p)}`);
      };
      walk(null, '');
      return lines.join('\n');
    },
  },
  {
    name: 'search_notes',
    title: 'Search the notes',
    description: 'Finds pages whose title or aliases fit the query (typos forgiven), and pages whose text contains it, with a snippet of each.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    readOnly: true,
    run({ query }) {
      if (typeof query !== 'string' || !query.trim()) throw new ToolError('query must be some text.');
      const { pages } = notebook();
      const named = searchPages(query, searchablePages(pages), { currentPageId: '', folderId: null, recentPageIds: [] }, 10);
      const needle = query.trim().toLowerCase();
      const inText: string[] = [];
      for (const page of pages) {
        const text = page.boxes.map(boxMarkdown).join('\n\n');
        const at = text.toLowerCase().indexOf(needle);
        if (at < 0) continue;
        const snippet = text.slice(Math.max(0, at - 80), at + needle.length + 80).replace(/\s+/g, ' ');
        inText.push(`- ${page.title}: …${snippet}…`);
        if (inText.length === 20) break;
      }
      const lines: string[] = [];
      if (named.length) lines.push('Pages by name:', ...named.map((r) => `- ${r.viaAlias ? `${r.name} (alias of ${pages.find((p) => p.id === r.pageId)?.title})` : r.name}`));
      if (inText.length) lines.push(...(lines.length ? [''] : []), 'Pages whose text mentions it:', ...inText);
      return lines.length ? lines.join('\n') : `Nothing in the notes matches "${query}".`;
    },
  },
  {
    name: 'read_page',
    title: 'Read a page',
    description:
      'A page as Markdown: its title, type, aliases and folder, then each text box, numbered (pages are free canvases holding several boxes). Links to pages show as [[Title]].',
    inputSchema: { type: 'object', properties: { page: PAGE_ARG }, required: ['page'] },
    readOnly: true,
    run({ page: name }) {
      const page = findPage(name);
      const { folders, pages } = notebook();
      const lines = [`# ${page.title}`, `Type: ${describeType(page, pages)}`];
      if (page.aliases?.length) lines.push(`Also called: ${page.aliases.join(', ')}`);
      lines.push(`Folder: ${folderPath(folders, page.folderId) || '(top level)'}`);
      if (page.statBlock) lines.push('Has a stat block.');
      if (!page.boxes.length) lines.push('', '(No text yet.)');
      page.boxes.forEach((box, i) => lines.push('', `--- Text box ${i + 1} ---`, boxMarkdown(box)));
      return lines.join('\n');
    },
  },
  {
    name: 'create_page',
    title: 'Create a page',
    description:
      'Makes a new page, optionally in a folder (made if missing), with a type, aliases and starting text. Fails if a page already has that title; use add_text or update_page for those.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        folder: { type: 'string', description: 'Folder path like "Places/Cities"; the top level when left out.' },
        ...TYPE_ARGS,
        text: TEXT_ARG,
      },
      required: ['title'],
    },
    run(args) {
      const title = typeof args.title === 'string' ? args.title.trim().replace(/\s+/g, ' ') : '';
      if (!title) throw new ToolError('title must be the page name.');
      if (notebook().pages.some((p) => normalizeTitle(p.title) === normalizeTitle(title))) throw new ToolError(`A page called "${title}" already exists.`);
      const aliases = aliasesArg(args.aliases);
      const text = args.text === undefined ? null : textArg(args.text);
      const id = notebook().addPage(folderAt(args.folder), title);
      applyType(notebook().pages.find((p) => p.id === id)!, args);
      if (aliases) notebook().setPageAliases(id, aliases);
      if (text) addBoxBelow(notebook().pages.find((p) => p.id === id)!, text.doc);
      return `Created "${title}".${text?.note ?? ''}`;
    },
  },
  {
    name: 'add_text',
    title: 'Add text to a page',
    description: "Adds a new text box under a page's other boxes. Use this to add to a page without touching what is there.",
    inputSchema: { type: 'object', properties: { page: PAGE_ARG, text: TEXT_ARG }, required: ['page', 'text'] },
    run({ page: name, text }) {
      const page = findPage(name);
      const { doc, note } = textArg(text);
      const number = addBoxBelow(page, doc);
      return `Added text box ${number} to "${page.title}".${note}`;
    },
  },
  {
    name: 'replace_text',
    title: "Replace a text box's text",
    description:
      'Replaces everything in one text box of a page with new text (read the page first, and keep what should stay). The box keeps its place on the page.',
    inputSchema: {
      type: 'object',
      properties: { page: PAGE_ARG, box: { type: 'integer', minimum: 1, description: 'The text box number from read_page; may be left out when the page has one box.' }, text: TEXT_ARG },
      required: ['page', 'text'],
    },
    run({ page: name, box, text }) {
      const page = findPage(name);
      const number = boxArg(page, box);
      const { doc, note } = textArg(text);
      notebook().replaceBoxContent(page.id, page.boxes[number - 1].id, doc);
      return `Replaced text box ${number} of "${page.title}".${note}`;
    },
  },
  {
    name: 'update_page',
    title: "Change a page's details",
    description: "Renames a page (links to it keep working), moves it to a folder, or changes its type, character kind, the place it is inside, or its aliases. Only what is given changes.",
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARG,
        title: { type: 'string', description: 'New title.' },
        folder: { type: 'string', description: 'Folder path to move it to ("" for the top level); made if missing.' },
        ...TYPE_ARGS,
      },
      required: ['page'],
    },
    run(args) {
      const page = findPage(args.page);
      const changes: string[] = [];
      if (args.title !== undefined) {
        const title = typeof args.title === 'string' ? args.title.trim().replace(/\s+/g, ' ') : '';
        if (!title) throw new ToolError('title must be the new page name.');
        if (notebook().pages.some((p) => p.id !== page.id && normalizeTitle(p.title) === normalizeTitle(title))) throw new ToolError(`A page called "${title}" already exists.`);
        notebook().renamePage(page.id, title);
        changes.push(`renamed to "${title}"`);
      }
      const aliases = aliasesArg(args.aliases);
      if (args.folder !== undefined) {
        const folderId = folderAt(args.folder || null);
        notebook().movePage(page.id, folderId);
        changes.push(`moved to ${folderPath(notebook().folders, folderId) || 'the top level'}`);
      }
      if (args.type !== undefined || args.character_kind !== undefined || args.inside_place !== undefined) {
        applyType(notebook().pages.find((p) => p.id === page.id)!, args);
        const updated = notebook().pages.find((p) => p.id === page.id)!;
        changes.push(`now ${describeType(updated, notebook().pages)}`);
      }
      if (aliases) {
        notebook().setPageAliases(page.id, aliases);
        changes.push(aliases.length ? `also called ${aliases.join(', ')}` : 'aliases removed');
      }
      return changes.length ? `"${page.title}": ${changes.join('; ')}.` : 'Nothing to change: give a title, folder, type, character_kind, inside_place or aliases.';
    },
  },
  {
    name: 'link_mentions',
    title: 'Link mentions on a page',
    description:
      "Links every unlinked mention of another page's title or alias in a page's text (what the user does one at a time with the link buttons). Plurals count.",
    inputSchema: { type: 'object', properties: { page: PAGE_ARG }, required: ['page'] },
    run({ page: name }) {
      const page = findPage(name);
      const others = notebook().pages.filter((p) => p.id !== page.id);
      const matcher = createTitleMatcher([
        ...others.map((p) => ({ pageId: p.id, title: p.title })),
        ...others.flatMap((p) => (p.aliases ?? []).map((title) => ({ pageId: p.id, title }))),
      ]);
      const linked = new Set<Id>();
      for (const box of page.boxes) {
        const result = linkMentions(box.content, matcher);
        if (!result.linked.length) continue;
        result.linked.forEach((id) => linked.add(id));
        notebook().replaceBoxContent(page.id, box.id, result.doc);
      }
      const titles = [...linked].map((id) => others.find((p) => p.id === id)!.title);
      return titles.length ? `Linked mentions of ${titles.map((t) => `"${t}"`).join(', ')} on "${page.title}".` : `"${page.title}" has no unlinked mentions of other pages.`;
    },
  },
];
