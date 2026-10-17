import React, { useEffect } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  icon?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number | string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  maxWidth = 580,
}) => {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cr-modal-overlay" onClick={onClose}>
      <div
        className="cr-modal-dialog"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="cr-modal-header">
          <h3>
            {icon && <i className={icon} style={{ marginRight: 8 }} />}
            {title}
          </h3>
          <button
            type="button"
            className="cr-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className="cr-modal-body">{children}</div>
        {footer && <div className="cr-modal-footer">{footer}</div>}
      </div>
    </div>
  );
};
