/**
 * @file App updates on desktop: asks GitHub Releases (through Tauri's updater)
 * whether a newer version is out, downloads and installs it, and restarts into
 * it. A quiet check runs shortly after start; Settings → Updates checks on
 * request. Android updates by installing a new APK, and the browser version is
 * always current, so neither checks.
 */
import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { create } from 'zustand';
import { isMobile, isTauri } from '../platform';

/** Where an update stands. */
export type UpdateStatus = 'idle' | 'checking' | 'current' | 'available' | 'installing' | 'error';

interface UpdateState {
  status: UpdateStatus;
  /** This copy's version, once known. */
  current: string | null;
  /** The newer version, while one is available or installing. */
  version: string | null;
  /** Download progress (0–1) while installing, if the size is known. */
  progress: number | null;
  /** What went wrong, for the last check or install asked for by hand. */
  error: string | null;
  /** The user closed the notice for this version. */
  dismissed: string | null;
}

export const useUpdates = create<UpdateState>(() => ({
  status: 'idle',
  current: null,
  version: null,
  progress: null,
  error: null,
  dismissed: null,
}));

/** How long after start the quiet check waits, so it doesn't slow loading (ms). */
const FIRST_CHECK_DELAY_MS = 5000;

/** The update found by the last check (the plugin's handle to download it). */
let pending: Update | null = null;

/** This device can update itself: the desktop app. */
export const updatesAvailable = () => isTauri() && !isMobile();

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Looks for a newer version. A quiet check (on start) keeps failures, such as being offline, to itself. */
export async function checkForUpdates({ quiet = false } = {}): Promise<void> {
  if (!updatesAvailable()) return;
  const { status } = useUpdates.getState();
  if (status === 'checking' || status === 'installing') return;
  useUpdates.setState({ status: 'checking', error: null });
  try {
    const found = await check();
    pending = found;
    useUpdates.setState(found ? { status: 'available', version: found.version } : { status: 'current', version: null });
  } catch (err) {
    useUpdates.setState({ status: quiet ? 'idle' : 'error', error: quiet ? null : `Couldn't check for updates: ${message(err)}` });
  }
}

/** Downloads and installs the update found, then restarts into it. */
export async function installUpdate(): Promise<void> {
  if (!pending || useUpdates.getState().status === 'installing') return;
  useUpdates.setState({ status: 'installing', progress: null, error: null });
  let total = 0;
  let received = 0;
  try {
    await pending.downloadAndInstall((event) => {
      if (event.event === 'Started') total = event.data.contentLength ?? 0;
      else if (event.event === 'Progress') {
        received += event.data.chunkLength;
        if (total) useUpdates.setState({ progress: Math.min(1, received / total) });
      }
    });
    // On Windows the installer closes the app and opens the new one itself; elsewhere, restart here.
    await relaunch();
  } catch (err) {
    useUpdates.setState({ status: 'available', progress: null, error: `Couldn't install the update: ${message(err)}` });
  }
}

/** Hides the notice for the version on offer (Settings → Updates still offers it). */
export const dismissUpdate = () => useUpdates.setState((s) => ({ dismissed: s.version }));

/** On desktop: learns this copy's version, and checks quietly a few seconds after start. */
export function startUpdates(): void {
  if (!updatesAvailable()) return;
  void getVersion().then((current) => useUpdates.setState({ current }));
  setTimeout(() => void checkForUpdates({ quiet: true }), FIRST_CHECK_DELAY_MS);
}
