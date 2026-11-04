/**
 * @file The assistant's connections to model servers and which one (and
 * which model) is in use, saved in the assistant's settings document. API
 * keys and sign-in tokens are saved there too, on this device only.
 */
import { create } from 'zustand';
import { createDocuments } from '../../storage/documents';
import { getJson, request } from '../models/http';
import type { Connection, ConnectionKind } from '../models/types';

/** The assistant's documents: settings and chats. */
export const assistantDocuments = createDocuments('assistant');
const SETTINGS_DOC = 'settings';

/** Where the paid APIs live. */
export const API_BASE_URLS: Partial<Record<ConnectionKind, string>> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
};

interface Settings {
  connections: Connection[];
  /** The connection new messages go to. */
  currentId: string | null;
}

interface SettingsState extends Settings {
  /** Adds a connection (replacing one at the same address and kind) and makes it current. */
  connect(connection: Omit<Connection, 'id'>): Connection;
  remove(id: string): void;
  /** Makes a connection current, optionally choosing its model. */
  use(id: string, model?: string): void;
}

const newId = () => crypto.randomUUID();

export const useAssistantSettings = create<SettingsState>((set, get) => ({
  connections: [],
  currentId: null,

  connect(fields) {
    const existing = get().connections.find((c) => c.kind === fields.kind && c.baseUrl === fields.baseUrl);
    const connection: Connection = { ...existing, ...fields, id: existing?.id ?? newId() };
    if (connection.kind === 'redstart') connection.deviceId ??= newId();
    set((s) => ({
      connections: existing ? s.connections.map((c) => (c.id === existing.id ? connection : c)) : [...s.connections, connection],
      currentId: connection.id,
    }));
    return connection;
  },

  remove(id) {
    set((s) => {
      const connections = s.connections.filter((c) => c.id !== id);
      return { connections, currentId: s.currentId === id ? (connections[0]?.id ?? null) : s.currentId };
    });
  },

  use(id, model) {
    set((s) => ({
      currentId: id,
      connections: model === undefined ? s.connections : s.connections.map((c) => (c.id === id ? { ...c, model } : c)),
    }));
  },
}));

/** The connection in use, if any. */
export function currentConnection(): Connection | undefined {
  const { connections, currentId } = useAssistantSettings.getState();
  return connections.find((c) => c.id === currentId);
}

/** Signs in to a Redstart Nest; returns the session token, or throws with Redstart's reason. */
export async function signInToRedstart(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await request(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    timeoutMs: 10000,
  });
  const body = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!response.ok || !body.token) throw new Error(body.error ?? `Sign-in failed (${response.status})`);
  return body.token;
}

/** Whether a Redstart Nest wants a sign-in. */
export async function redstartNeedsSignIn(baseUrl: string): Promise<boolean> {
  return (await getJson<{ authRequired?: boolean }>(`${baseUrl}/auth/config`, {}, 3000))?.data?.authRequired !== false;
}

/** Loads the settings, then saves them whenever they change. */
export async function startAssistantSettings(): Promise<void> {
  const loaded = await assistantDocuments.loadDocument<Settings>(SETTINGS_DOC, () => ({ connections: [], currentId: null }));
  const connections = Array.isArray(loaded.data.connections) ? loaded.data.connections : [];
  useAssistantSettings.setState({ connections, currentId: loaded.data.currentId ?? connections[0]?.id ?? null });
  useAssistantSettings.subscribe((s) => {
    assistantDocuments.saveDocument<Settings>(SETTINGS_DOC, { connections: s.connections, currentId: s.currentId }).catch(() => undefined);
  });
}
