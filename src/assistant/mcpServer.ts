/**
 * @file The app's side of the Model Context Protocol (MCP), which Claude and
 * other AI apps use to call tools. The native shell carries the messages
 * (JSON-RPC 2.0) between the AI app and here (see connection.ts); this
 * answers them: the handshake, the list of tools, and tool calls. Changes
 * that Settings don't allow AI apps to make are left out of the list and
 * refused.
 */
import { appPermission } from './chat/settings';
import { runRecorded } from './history/recordedRun';
import { ALL_TOOLS, toolNamed } from './tools';
import { outputImage, outputText, ToolError, type Tool } from './tools/types';

/** Protocol versions this server speaks, newest first. */
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

/** Told to the AI app on connecting: what the app is and how to work with it. */
export const INSTRUCTIONS = `Dungeon Books is a tabletop RPG campaign app. Each campaign has encounters (the Encounters tab) and notes (the Lorekeeper tab). These tools work on the campaign open in the app: its notes (and the images and maps on its pages), and, looking only, its encounters.

Notes are pages in nested folders. Each page has a title, a type (note, character, place, faction or item), optional aliases (other names it goes by), and text in one or more text boxes laid out on a canvas. Characters are NPCs or player characters; places can sit inside other places.

Pages link to each other: text that mentions another page links to it. In text you write, link with [[Page Title]] or [[Page Title|the words to show]]; the title or any alias works. Links follow pages through renames.

Working well with the user's notes:
- Call get_overview first, and read_page before changing a page.
- Prefer add_text, which leaves existing text alone. replace_text overwrites a whole text box, so carry over anything that should stay.
- Before creating a page, check (search_notes) that one doesn't exist under another name; add aliases rather than making duplicates.
- Give new characters, places, factions and items their own pages with the right type, and link to them.
- After writing, link_mentions can link the remaining mentions of existing pages.
- add_image puts a picture on a page from a file on this computer (full path), a web address, or base64; draw_image draws one from SVG you write (a map's layout, a diagram), or redraws an image in place keeping its pins. Images on pages are numbered as read_page lists them. To work with a map, view_image shows it with a grid (spots are x, y from 0 to 1) and its numbered pins; then add_pin, move_pin or remove_pin. Pins point at pages, so make the page first if it is missing.
- For encounters, list_encounters and read_encounter show what is there; search_creatures and read_creature find creatures (the user's characters, and the SRD's for 5e); rate_encounter says how hard a planned fight would be. Encounters can't be changed from here yet, so suggest the fight and let the user build it.
- These are the user's notes: keep their wording and facts unless asked to change them, and say what you changed.
The user can undo each change made here (Settings → AI changes), and nothing here deletes pages.`;

/** The tools AI apps may use right now. */
const tools = (): Tool[] => ALL_TOOLS.filter((t) => t.readOnly || appPermission(t.name) === 'allow');

interface Request {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC error codes. */
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

/** A tool call's result: its text (after its picture, if it has one), marked as an error when the call failed (so the AI can correct itself). */
async function callTool(params: Record<string, unknown> | undefined) {
  const tool = toolNamed(params?.name);
  if (!tool) throw new RpcError(INVALID_PARAMS, `Unknown tool: ${String(params?.name)}`);
  if (!tools().includes(tool)) {
    const text = `The user's settings in Dungeon Books don't let AI apps use ${tool.name}. They can change that in Settings → AI apps.`;
    return { content: [{ type: 'text', text }], isError: true };
  }
  const args = (params?.arguments ?? {}) as Record<string, unknown>;
  try {
    const { output } = await runRecorded(tool, args, 'app');
    const image = outputImage(output);
    const text = { type: 'text', text: outputText(output) };
    return { content: image ? [{ type: 'image', data: image.data, mimeType: image.mimeType }, text] : [text], isError: false };
  } catch (e) {
    const text = e instanceof ToolError ? e.message : `Something went wrong in Dungeon Books: ${e instanceof Error ? e.message : String(e)}`;
    return { content: [{ type: 'text', text }], isError: true };
  }
}

/** The result for one request. */
async function answer(request: Request, version: string): Promise<unknown> {
  switch (request.method) {
    case 'initialize': {
      const asked = request.params?.protocolVersion;
      return {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked as string) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'dungeon-books', title: 'Dungeon Books', version },
        instructions: INSTRUCTIONS,
      };
    }
    case 'ping':
      return {};
    case 'tools/list':
      return {
        tools: tools().map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { title: t.title, readOnlyHint: !!t.readOnly, destructiveHint: t.name === 'replace_text', openWorldHint: false },
        })),
      };
    case 'tools/call':
      return callTool(request.params);
    default:
      throw new RpcError(METHOD_NOT_FOUND, `Unknown method: ${request.method}`);
  }
}

/** The response to one message, or null for a notification (or a response from the client). */
async function handleOne(message: unknown, version: string): Promise<object | null> {
  if (typeof message !== 'object' || message === null || (message as Request).jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id: null, error: { code: INVALID_REQUEST, message: 'Not a JSON-RPC 2.0 message' } };
  }
  const request = message as Request;
  if (typeof request.method !== 'string' || request.id === undefined) return null;
  try {
    return { jsonrpc: '2.0', id: request.id, result: await answer(request, version) };
  } catch (e) {
    const code = e instanceof RpcError ? e.code : INVALID_REQUEST;
    return { jsonrpc: '2.0', id: request.id, error: { code, message: e instanceof Error ? e.message : String(e) } };
  }
}

/**
 * Answers a message body (one message, or a batch) from an AI app. Returns
 * the response body, or '' when there is nothing to send back.
 */
export async function handleMcpBody(body: string, version: string): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: PARSE_ERROR, message: 'Invalid JSON' } });
  }
  if (Array.isArray(parsed)) {
    // One at a time, in order, so changes apply in the order the app sent them.
    const responses: object[] = [];
    for (const m of parsed) {
      const r = await handleOne(m, version);
      if (r) responses.push(r);
    }
    return responses.length ? JSON.stringify(responses) : '';
  }
  const response = await handleOne(parsed, version);
  return response ? JSON.stringify(response) : '';
}
