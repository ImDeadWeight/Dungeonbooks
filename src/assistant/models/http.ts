/**
 * @file HTTP for talking to AI models. In the app, requests go out through
 * the native side (Tauri's HTTP plugin), so model servers don't need to allow
 * this app's web origin (CORS) and plain http on the local network works. In
 * a browser (development) it is the browser's own fetch.
 */
import { fetch as nativeFetch } from '@tauri-apps/plugin-http';
import { isTauri } from '../../platform';

/** fetch, through the native side when there is one. */
export function request(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs, ...rest } = init;
  const signals = [rest.signal, timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined].filter((s): s is AbortSignal => !!s);
  const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];
  return (isTauri() ? nativeFetch : globalThis.fetch)(url, { ...rest, signal });
}

/** GETs JSON; null when the server isn't there, doesn't answer in time, or answers with an error. */
export async function getJson<T>(url: string, headers: Record<string, string> = {}, timeoutMs = 1500): Promise<{ status: number; data: T | null } | null> {
  try {
    const response = await request(url, { headers, timeoutMs });
    if (!response.ok) return { status: response.status, data: null };
    return { status: response.status, data: (await response.json()) as T };
  } catch {
    return null;
  }
}

/**
 * The events of a server-sent event stream (the "data:" payloads), as they
 * arrive. Both OpenAI-style and Anthropic streaming answers use this format.
 */
export async function* serverSentEvents(response: Response): AsyncGenerator<string> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const event = buffer.slice(0, end);
      buffer = buffer.slice(end).replace(/^\r?\n\r?\n/, '');
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
      if (data) yield data;
    }
  }
  const rest = buffer.trim();
  if (rest.startsWith('data:')) yield rest.slice(5).trim();
}
