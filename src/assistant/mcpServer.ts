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
import { NOTES_TOOLS, ToolError, type Tool } from './notesTools';

/** Protocol versions this server speaks, newest first. */
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

/** Told to the AI app on connecting: what the app is and how to work with it. */
export const INSTRUCTIONS = `Dungeon Books is a tabletop RPG campaign app. Each campaign has encounters (the Encounters tab) and notes (the Lorekeeper tab). These tools work on the notes of the campaign open in the app.

Notes are pages in nested folders. Each page has a title, a type (note, character, place, faction or item), optional aliases (other names it goes by), and text in one or more text boxes laid out on a canvas. Characters are NPCs or player characters; places can sit inside other places.

Pages link to each other: text that mentions another page links to it. In text you write, link with [[Page Title]] or [[Page Title|the words to show]]; the title or any alias works. Links follow pages through renames.

Working well with the user's notes:
- Call get_overview first, and read_page before changing a page.
- Prefer add_text, which leaves existing text alone. replace_text overwrites a whole text box, so carry over anything that should stay.
- Before creating a page, check (search_notes) that one doesn't exist under another name; add aliases rather than making duplicates.
- Give new characters, places, factions and items their own pages with the right type, and link to them.
- After writing, link_mentions can link the remaining mentions of existing pages.
- These are the user's notes: keep their wording and facts unless asked to change them, and say what you changed.
The user can undo each change made here (Settings → AI changes), and nothing here deletes pages.`;

/** The tools AI apps may use right now. */
const tools = (): Tool[] => NOTES_TOOLS.filter((t) => t.readOnly || appPermission(t.name) === 'allow');

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

/** A tool call's result: its text, marked as an error when the call failed (so the AI can correct itself). */
function callTool(params: Record<string, unknown> | undefined) {
  const tool = NOTES_TOOLS.find((t) => t.name === params?.name);
  if (!tool) throw new RpcError(INVALID_PARAMS, `Unknown tool: ${String(params?.name)}`);
  if (!tools().includes(tool)) {
    const text = `The user's settings in Dungeon Books don't let AI apps use ${tool.name}. They can change that in Settings → AI apps.`;
    return { content: [{ type: 'text', text }], isError: true };
  }
  const args = (params?.arguments ?? {}) as Record<string, unknown>;
  try {
    return { content: [{ type: 'text', text: runRecorded(tool, args, 'app').text }], isError: false };
  } catch (e) {
    const text = e instanceof ToolError ? e.message : `Something went wrong in Dungeon Books: ${e instanceof Error ? e.message : String(e)}`;
    return { content: [{ type: 'text', text }], isError: true };
  }
}

/** The result for one request. */
function answer(request: Request, version: string): unknown {
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
function handleOne(message: unknown, version: string): object | null {
  if (typeof message !== 'object' || message === null || (message as Request).jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id: null, error: { code: INVALID_REQUEST, message: 'Not a JSON-RPC 2.0 message' } };
  }
  const request = message as Request;
  if (typeof request.method !== 'string' || request.id === undefined) return null;
  try {
    return { jsonrpc: '2.0', id: request.id, result: answer(request, version) };
  } catch (e) {
    const code = e instanceof RpcError ? e.code : INVALID_REQUEST;
    return { jsonrpc: '2.0', id: request.id, error: { code, message: e instanceof Error ? e.message : String(e) } };
  }
}

/**
 * Answers a message body (one message, or a batch) from an AI app. Returns
 * the response body, or '' when there is nothing to send back.
 */
export function handleMcpBody(body: string, version: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: PARSE_ERROR, message: 'Invalid JSON' } });
  }
  if (Array.isArray(parsed)) {
    const responses = parsed.map((m) => handleOne(m, version)).filter((r) => r !== null);
    return responses.length ? JSON.stringify(responses) : '';
  }
  const response = handleOne(parsed, version);
  return response ? JSON.stringify(response) : '';
}
