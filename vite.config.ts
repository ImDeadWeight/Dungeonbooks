/**
 * @file Vite build/dev-server config (React plugin, fixed port 1440 for
 * Tauri, per-tab CSS scoping) and Vitest settings.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { scopeTabCss } from './build/scopeTabCss';

// Tauri expects a fixed dev port and must not have the screen cleared.
// Encounters uses 1420 and Lorekeeper 1430, so all three can run at once.
export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [scopeTabCss()] } },
  clearScreen: false,
  server: { port: 1440, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
  test: { environment: 'node' },
});
