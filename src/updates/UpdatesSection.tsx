/**
 * @file Settings → Updates (desktop app): this copy's version, a check on
 * request, and installing a version found.
 */
import { checkForUpdates, installUpdate, useUpdates, type UpdateStatus } from './updateStore';
import './updates.css';

/** What the last check found, in a line. */
const SUMMARY: Record<UpdateStatus, (version: string | null) => string | null> = {
  idle: () => null,
  checking: () => 'Checking…',
  current: () => "You're on the latest version.",
  available: (v) => `Dungeon Books ${v} is available.`,
  installing: (v) => `Downloading Dungeon Books ${v}…`,
  error: () => null,
};

export function UpdatesSection() {
  const { status, current, version, progress, error } = useUpdates();
  const summary = SUMMARY[status](version);
  const busy = status === 'checking' || status === 'installing';
  return (
    <>
      <h3>Version</h3>
      <p className="muted">
        You have Dungeon Books {current ?? '…'}. It checks for a new version each time it starts, and asks before
        installing one; the app restarts into the new version, and your campaigns stay as they are.
      </p>
      <div className="updates-actions">
        {status === 'available' || status === 'installing' ? (
          <button className="primary" disabled={busy} onClick={() => void installUpdate()}>
            {status === 'installing' && progress !== null ? `Downloading: ${Math.round(progress * 100)}%` : 'Update and restart'}
          </button>
        ) : (
          <button disabled={busy} onClick={() => void checkForUpdates()}>
            Check for updates
          </button>
        )}
        {summary && <span className="muted">{summary}</span>}
      </div>
      {error && <p className="updates-error">{error}</p>}
    </>
  );
}
