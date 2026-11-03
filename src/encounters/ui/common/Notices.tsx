/**
 * @file On-screen notices (toasts) at the bottom of the window.
 */
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useUi, type Notice } from '../../state/uiStore';
import './notices.css';

/** How long info notices stay before fading. */
const INFO_TIMEOUT_MS = 4000;

/** One notice with a dismiss button; info notices close themselves. */
function NoticeItem({ notice }: { notice: Notice }) {
  const dismiss = useUi((s) => s.dismissNotice);
  useEffect(() => {
    // Errors stay until dismissed so they can't be missed.
    if (notice.tone !== 'info') return;
    const t = setTimeout(() => dismiss(notice.id), INFO_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [notice, dismiss]);
  return (
    <div className={`notice notice-${notice.tone}`}>
      <span>{notice.text}</span>
      <button className="icon" onClick={() => dismiss(notice.id)} title="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

/** All current notices, stacked. */
export function Notices() {
  const notices = useUi((s) => s.notices);
  return (
    <div className="notices">
      {notices.map((n) => (
        <NoticeItem key={n.id} notice={n} />
      ))}
    </div>
  );
}
