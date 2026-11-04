/**
 * @file Talking to models: listing a server's models, and one streamed chat
 * request with tools, in the OpenAI style (local runners, Redstart, OpenAI)
 * or Anthropic's.
 */
import { getJson, request, serverSentEvents } from './http';
import { ModelError, type ChatMessage, type ChatReply, type ChatRequest, type Connection, type ToolCall } from './types';

const ANTHROPIC_VERSION = '2023-06-01';
/** Longest answer asked for from Anthropic (it requires a limit). */
const ANTHROPIC_MAX_TOKENS = 8192;

/** The headers a connection's requests carry. */
export function headersFor(connection: Connection): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (connection.kind === 'anthropic') {
    if (connection.apiKey) headers['x-api-key'] = connection.apiKey;
    headers['anthropic-version'] = ANTHROPIC_VERSION;
  } else if (connection.apiKey) {
    headers.Authorization = `Bearer ${connection.apiKey}`;
  }
  if (connection.deviceId) headers['X-Redstart-Device-Id'] = connection.deviceId;
  return headers;
}

/** The ids of the models a server offers (empty when it can't be asked). */
export async function listModels(connection: Connection): Promise<string[]> {
  const answer = await getJson<{ data?: { id: string }[] }>(`${connection.baseUrl}/v1/models`, headersFor(connection), 5000);
  const ids = (answer?.data?.data ?? []).map((m) => m.id).filter(Boolean);
  // OpenAI lists every model it has, most of which can't chat.
  return connection.kind === 'openai' ? ids.filter((id) => /^(gpt|o\d|chatgpt)/.test(id)).sort().reverse() : ids;
}

/** A failed response, worded for the user (with the server's own message when it gave one). */
async function failure(response: Response, connection: Connection): Promise<ModelError> {
  let detail = '';
  try {
    const body = await response.text();
    const parsed = JSON.parse(body);
    detail = parsed?.error?.message ?? parsed?.error ?? parsed?.message ?? body;
  } catch {
    // Not JSON: the status says enough.
  }
  const what =
    response.status === 401 || response.status === 403
      ? `${connection.name} refused the sign-in or key`
      : response.status === 404
        ? `${connection.name} doesn't know that model or address`
        : `${connection.name} answered with an error (${response.status})`;
  return new ModelError(detail ? `${what}: ${String(detail).slice(0, 300)}` : `${what}.`);
}

/** Parses a tool call's arguments; null when they aren't a JSON object. */
function parseArgs(raw: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(raw || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** Sends the request; a server that can't be reached becomes a ModelError. */
async function send(url: string, connection: Connection, body: object, signal?: AbortSignal): Promise<Response> {
  let response: Response;
  try {
    response = await request(url, { method: 'POST', headers: headersFor(connection), body: JSON.stringify(body), signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ModelError(`Couldn't reach ${connection.name} at ${connection.baseUrl}. Is it running?`);
  }
  if (!response.ok) throw await failure(response, connection);
  return response;
}

// ---- OpenAI style ----------------------------------------------------------------

/** Messages in the OpenAI chat format. */
function openAiMessages(system: string, messages: ChatMessage[]): object[] {
  const out: object[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.text });
    else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.text || null,
        ...(m.toolCalls.length
          ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.rawArgs || '{}' } })) }
          : {}),
      });
    } else {
      for (const r of m.results) out.push({ role: 'tool', tool_call_id: r.callId, content: r.text });
    }
  }
  return out;
}

async function openAiChat(req: ChatRequest): Promise<ChatReply> {
  const body = {
    model: req.model,
    stream: true,
    messages: openAiMessages(req.system, req.messages),
    ...(req.tools.length ? { tools: req.tools.map((t) => ({ type: 'function', function: t })) } : {}),
  };
  const response = await send(`${req.connection.baseUrl}/v1/chat/completions`, req.connection, body, req.signal);
  let text = '';
  // Tool calls stream in pieces, keyed by their index.
  const calls: { id: string; name: string; args: string }[] = [];
  for await (const data of serverSentEvents(response)) {
    if (data === '[DONE]') break;
    let event: { choices?: { delta?: { content?: string; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[]; error?: { message?: string } };
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    if (event.error) throw new ModelError(`${req.connection.name}: ${event.error.message ?? 'error'}`);
    const delta = event.choices?.[0]?.delta;
    if (delta?.content) {
      text += delta.content;
      req.onText?.(delta.content);
    }
    for (const piece of delta?.tool_calls ?? []) {
      const i = piece.index ?? calls.length;
      calls[i] ??= { id: '', name: '', args: '' };
      if (piece.id) calls[i].id = piece.id;
      if (piece.function?.name) calls[i].name += piece.function.name;
      if (piece.function?.arguments) calls[i].args += piece.function.arguments;
    }
  }
  const toolCalls: ToolCall[] = calls
    .filter((c) => c?.name)
    .map((c, i) => ({ id: c.id || `call_${Date.now()}_${i}`, name: c.name, rawArgs: c.args, args: parseArgs(c.args) }));
  return { text, toolCalls };
}

// ---- Anthropic -----------------------------------------------------------------------

/** Messages in Anthropic's format: tool calls are content blocks, and their results go back as the user's. */
function anthropicMessages(messages: ChatMessage[]): object[] {
  return messages.map((m) => {
    if (m.role === 'user') return { role: 'user', content: m.text };
    if (m.role === 'assistant') {
      const content: object[] = [];
      if (m.text) content.push({ type: 'text', text: m.text });
      for (const c of m.toolCalls) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args ?? {} });
      return { role: 'assistant', content: content.length ? content : [{ type: 'text', text: '…' }] };
    }
    return { role: 'user', content: m.results.map((r) => ({ type: 'tool_result', tool_use_id: r.callId, content: r.text, is_error: r.isError })) };
  });
}

async function anthropicChat(req: ChatRequest): Promise<ChatReply> {
  const body = {
    model: req.model,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    stream: true,
    system: req.system,
    messages: anthropicMessages(req.messages),
    ...(req.tools.length ? { tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}),
  };
  const response = await send(`${req.connection.baseUrl}/v1/messages`, req.connection, body, req.signal);
  let text = '';
  const blocks: { id: string; name: string; json: string }[] = [];
  for await (const data of serverSentEvents(response)) {
    let event: {
      type: string;
      index?: number;
      content_block?: { type: string; id?: string; name?: string };
      delta?: { type: string; text?: string; partial_json?: string };
      error?: { message?: string };
    };
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    if (event.type === 'error') throw new ModelError(`${req.connection.name}: ${event.error?.message ?? 'error'}`);
    if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
      blocks[event.index!] = { id: event.content_block.id!, name: event.content_block.name!, json: '' };
    } else if (event.type === 'content_block_delta') {
      if (event.delta?.type === 'text_delta' && event.delta.text) {
        text += event.delta.text;
        req.onText?.(event.delta.text);
      } else if (event.delta?.type === 'input_json_delta' && blocks[event.index!]) {
        blocks[event.index!].json += event.delta.partial_json ?? '';
      }
    }
  }
  const toolCalls = blocks.filter(Boolean).map((b) => ({ id: b.id, name: b.name, rawArgs: b.json || '{}', args: parseArgs(b.json) }));
  return { text, toolCalls };
}

/** One streamed chat request with tools. */
export function chat(req: ChatRequest): Promise<ChatReply> {
  return req.connection.kind === 'anthropic' ? anthropicChat(req) : openAiChat(req);
}
