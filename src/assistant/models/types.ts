/**
 * @file The shapes the assistant works with: connections to model servers,
 * and chat messages in a form both the OpenAI-style and Anthropic APIs can
 * be given.
 */

/**
 * How a model server is spoken to. `openai-compatible`: a local runner
 * (Ollama, LM Studio, llama.cpp, Jan…) at an address of its own. `redstart`:
 * a Redstart Nest gateway (OpenAI-style, with its own login). `openai` and
 * `anthropic`: those companies' paid APIs with the user's key.
 */
export type ConnectionKind = 'openai-compatible' | 'redstart' | 'openai' | 'anthropic';

/** A model server the user has connected. */
export interface Connection {
  id: string;
  kind: ConnectionKind;
  /** What the user sees ("Ollama", "Redstart on 192.168.1.20"). */
  name: string;
  /** Where its API lives, without a trailing slash: http://127.0.0.1:11434 (the /v1 is added per call). */
  baseUrl: string;
  /** Bearer token or API key, when the server needs one. Saved with the settings on this device. */
  apiKey?: string;
  /** Redstart: this device's id, which it keeps chats apart by when its login is off. */
  deviceId?: string;
  /** The model last chosen on it. */
  model?: string;
}

/** A tool the model is offered: its name, what it does, and its arguments as JSON Schema. */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: object;
}

/** A tool the model asked to call. */
export interface ToolCall {
  id: string;
  name: string;
  /** Parsed arguments; null when the model sent something that isn't a JSON object. */
  args: Record<string, unknown> | null;
  /** The arguments as the model sent them, for showing and for the API. */
  rawArgs: string;
}

/** What a tool call came back with. */
export interface ToolResult {
  callId: string;
  name: string;
  text: string;
  isError: boolean;
  /** The undoable change it made to the notes (see history/aiChanges.ts), if any. */
  changeId?: string;
}

/** One message of a chat. Tool results follow the assistant message that asked for them. */
export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls: ToolCall[] }
  | { role: 'tool'; results: ToolResult[] };

/** One request to a model. */
export interface ChatRequest {
  connection: Connection;
  model: string;
  system: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
  signal?: AbortSignal;
  /** Called with each piece of text as it streams in. */
  onText?: (text: string) => void;
}

/** A model's answer: its text and any tools it wants called. */
export interface ChatReply {
  text: string;
  toolCalls: ToolCall[];
}

/** A model server's failure, worded for the user. */
export class ModelError extends Error {}
