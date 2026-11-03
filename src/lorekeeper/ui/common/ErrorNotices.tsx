/**
 * @file Error messages (e.g. a failed save) pinned to the bottom of the
 * window until dismissed.
 */
import { X } from 'lucide-react';
import { useUi } from '../../state/uiStore';

/** Every pending error, each with a dismiss button. */
export function ErrorNotices() {
  const errors = useUi((s) => s.errors);
  const dismiss = useUi((s) => s.dismissError);
  if (errors.length === 0) return null;
  return (
    <div className="error-notices" role="alert">
      {errors.map((text, i) => (
        <div key={i} className="error-notice">
          <span className="spacer">{text}</span>
          <button className="icon" title="Dismiss" onClick={() => dismiss(i)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
