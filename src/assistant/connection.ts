/**
 * @file The web UI's end of AI connections (desktop app only): answers the
 * MCP requests the native shell's server receives (src-tauri/src/mcp.rs),
 * and reads or changes the connection settings for the Connect AI dialog.
 */
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { create } from 'zustand';
import { isMobile, isTauri } from '../platform';
import { handleMcpBody } from './mcpServer';

/** The connection as the native shell reports it. */
export interface ConnectionStatus {
  enabled: boolean;
  /** The server is listening (it can be enabled and not running, e.g. when the port is taken). */
  running: boolean;
  port: number;
  token: string;
  error: string | null;
  /** This program, for apps that start it with --mcp-stdio. */
  executable: string;
}

/** AI connections exist only in the desktop app (they need its native server). */
export const aiConnectionsAvailable = () => isTauri() && !isMobile();

/** The latest status, for the dialog. */
export const useAiConnection = create<{ status: ConnectionStatus | null }>(() => ({ status: null }));

const remember = (status: ConnectionStatus) => {
  useAiConnection.setState({ status });
  return status;
};

export const refreshStatus = () => invoke<ConnectionStatus>('ai_connection_status').then(remember);
export const setConnectionsEnabled = (enabled: boolean) => invoke<ConnectionStatus>('ai_connection_set_enabled', { enabled }).then(remember);
export const newConnectionToken = () => invoke<ConnectionStatus>('ai_connection_new_token').then(remember);

/** Starts answering AI apps' requests (once the data has loaded, so they never see an empty notebook). */
export async function startAiConnection() {
  if (!aiConnectionsAvailable()) return;
  const version = await getVersion();
  await listen<{ id: number; body: string }>('mcp-request', ({ payload }) => {
    const body = handleMcpBody(payload.body, version);
    void invoke('mcp_reply', { id: payload.id, body });
  });
  await invoke('mcp_attach');
}
