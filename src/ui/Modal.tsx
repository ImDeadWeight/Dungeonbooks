/**
 * @file Dialog frame: backdrop (click to close), title bar with close button,
 * scrolling body, optional footer.
 */
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import './modal.css';

/** Props for Modal. size: small (prompts), medium (previews), large (editors). */
interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'small' | 'medium' | 'large';
}

/** A dialog window. */
export function Modal({ title, onClose, children, footer, size = 'large' }: Props) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <span className="spacer" />
          <button className="icon" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
