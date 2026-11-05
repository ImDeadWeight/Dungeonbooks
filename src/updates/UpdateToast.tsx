/**
 * @file The notice that a new version is out: install it (the app restarts
 * into it), or dismiss it until the next version. Shows the download while
 * installing, and what went wrong if it fails.
 */
import { X } from 'lucide-react';
import { dismissUpdate, installUpdate, useUpdates } from './updateStore';
import './updates.css';

export function UpdateToast() {
  const { status, version, progress, error, dismissed } = useUpdates();
  if (!version || (status !== 'available' && status !== 'installing') || dismissed === version) return null;
  const installing = status === 'installing';
  return (
    <div className="update-toast" role="status">
      <span className="update-toast-text">
        {installing
          ? `Downloading Dungeon Books ${version}${progress === null ? '…' : `: ${Math.round(progress * 100)}%`}`
          : (error ?? `Dungeon Books ${version} is available.`)}
      </span>
      {!installing && (
        <>
          <button className="primary" onClick={() => void installUpdate()}>
            {error ? 'Try again' : 'Update and restart'}
          </button>
          <button className="icon" title="Not now" onClick={dismissUpdate}>
            <X size={15} />
          </button>
        </>
      )}
    </div>
  );
}
