import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAppSelector } from '../../store';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  icon?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number | string;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  maxWidth = 580,
  className = '',
}) => {
  useBodyScrollLock(open);

  const activeView = useAppSelector((s) => s.ui.activeView);
  const initialViewRef = useRef(activeView);

  // Close modal automatically if user navigates to another page / tab
  useEffect(() => {
    if (open && activeView !== initialViewRef.current) {
      onClose();
    }
    initialViewRef.current = activeView;
  }, [open, activeView, onClose]);

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

  const content = (
    <div
      className={`cr-modal-overlay ${className}`.trim()}
      onClick={onClose}
      style={{ zIndex: 100000 }}
    >
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

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
