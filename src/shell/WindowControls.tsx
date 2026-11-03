/**
 * @file Minimize, maximize/restore and close buttons for the custom desktop
 * title bar.
 */
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Copy, Minus, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Minimize / maximize / close for the themed title bar (native frame is hidden). */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    // Re-read whether the window is maximized (on mount and every resize).
    const sync = () => win.isMaximized().then(setMaximized).catch(() => undefined);
    sync();
    const unlisten = win.onResized(sync);
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const win = getCurrentWindow();
  return (
    <div className="window-controls">
      <button className="window-button" title="Minimize" onClick={() => win.minimize()}>
        <Minus size={16} />
      </button>
      <button className="window-button" title={maximized ? 'Restore' : 'Maximize'} onClick={() => win.toggleMaximize()}>
        {maximized ? <Copy size={14} /> : <Square size={14} />}
      </button>
      <button className="window-button close" title="Close" onClick={() => win.close()}>
        <X size={18} />
      </button>
    </div>
  );
}
