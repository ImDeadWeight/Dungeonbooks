/**
 * @file Finding model servers to connect to: the usual local runners on this
 * computer, and on the local network Redstart Nest (by its discovery beacon)
 * and runners shared to the network. Each runner answers the OpenAI-style
 * model list on its usual port.
 */
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../../platform';
import { getJson } from './http';
import type { ConnectionKind } from './types';

/** A server found answering. */
export interface FoundServer {
  kind: ConnectionKind;
  /** The runner's name ("Ollama"). */
  name: string;
  baseUrl: string;
  /** Its models, when it would list them without signing in. */
  models: string[];
  /** It wants a sign-in (or key) first. */
  needsSignIn: boolean;
}

/** Runners and the ports they listen on out of the box. */
const RUNNERS: { name: string; port: number }[] = [
  { name: 'Ollama', port: 11434 },
  { name: 'LM Studio', port: 1234 },
  { name: 'llama.cpp', port: 8080 },
  { name: 'Jan', port: 1337 },
  { name: 'KoboldCpp', port: 5001 },
  { name: 'text-generation-webui', port: 5000 },
  { name: 'vLLM', port: 8000 },
];
/** Redstart Nest's discovery beacon port, and its usual gateway port. */
const REDSTART_BEACON_PORT = 8765;

/** Looks for a runner's model list at an address. */
async function probeRunner(host: string, runner: { name: string; port: number }, timeoutMs: number): Promise<FoundServer | null> {
  const baseUrl = `http://${host}:${runner.port}`;
  const answer = await getJson<{ data?: { id: string }[] }>(`${baseUrl}/v1/models`, {}, timeoutMs);
  if (!answer) return null;
  if (answer.status === 401 || answer.status === 403) return { kind: 'openai-compatible', name: runner.name, baseUrl, models: [], needsSignIn: true };
  if (!answer.data || !Array.isArray(answer.data.data)) return null;
  return { kind: 'openai-compatible', name: runner.name, baseUrl, models: answer.data.data.map((m) => m.id), needsSignIn: false };
}

/** Asks a host's Redstart beacon whether Nest is serving, then its gateway whether a sign-in is needed. */
async function probeRedstart(host: string, timeoutMs: number): Promise<FoundServer | null> {
  const beacon = await getJson<{ app?: string; running?: boolean; port?: number }>(`http://${host}:${REDSTART_BEACON_PORT}/`, {}, timeoutMs);
  if (beacon?.data?.app !== 'redstart-nest') return null;
  const baseUrl = `http://${host}:${beacon.data.port ?? 19080}`;
  const name = host === '127.0.0.1' ? 'Redstart' : `Redstart on ${host}`;
  if (!beacon.data.running) return { kind: 'redstart', name: `${name} (no model running)`, baseUrl, models: [], needsSignIn: false };
  const config = await getJson<{ authRequired?: boolean }>(`${baseUrl}/auth/config`, {}, 3000);
  const needsSignIn = config?.data?.authRequired !== false;
  const models = needsSignIn ? [] : ((await getJson<{ data?: { id: string }[] }>(`${baseUrl}/v1/models`, {}, 3000))?.data?.data ?? []).map((m) => m.id);
  return { kind: 'redstart', name, baseUrl, models, needsSignIn };
}

/** Model servers on this computer. */
export async function detectLocal(): Promise<FoundServer[]> {
  const found = await Promise.all([probeRedstart('127.0.0.1', 1200), ...RUNNERS.map((r) => probeRunner('127.0.0.1', r, 1200))]);
  return found.filter((f): f is FoundServer => !!f);
}

/** Runs tasks with at most `limit` at a time. */
async function inBatches<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/** This device's address on the network, if it has one (needs the app; a browser can't tell). */
async function ownAddress(): Promise<string | null> {
  return isTauri() ? invoke<string | null>('local_ipv4').catch(() => null) : null;
}

/**
 * Model servers elsewhere on the local network (the /24 around this device):
 * Redstart Nest by its beacon, and Ollama and LM Studio when they are shared
 * to the network. Takes a few seconds.
 */
export async function detectNetwork(): Promise<FoundServer[]> {
  const own = await ownAddress();
  if (!own) return [];
  const prefix = own.split('.').slice(0, 3).join('.');
  const hosts = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`).filter((h) => h !== own);
  const shared = RUNNERS.filter((r) => r.name === 'Ollama' || r.name === 'LM Studio');
  const tasks = hosts.flatMap((host) => [() => probeRedstart(host, 800), ...shared.map((r) => () => probeRunner(host, r, 800))]);
  const found = await inBatches(tasks, 48);
  return found
    .filter((f): f is FoundServer => !!f)
    .map((f) => (f.kind === 'openai-compatible' ? { ...f, name: `${f.name} on ${new URL(f.baseUrl).hostname}` } : f));
}
