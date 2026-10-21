import React, { useEffect } from 'react';

export interface OverlayProps {
  open: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  lockScroll?: boolean;
  backdropBlur?: boolean;
  zIndex?: number;
}

export const Overlay: React.FC<OverlayProps> = ({
  open,
  onClose,
  children,
  className = '',
  style = {},
  lockScroll = true,
  backdropBlur = true,
  zIndex = 1050,
}) => {
  // Lock body scroll when overlay is active
  useEffect(() => {
    if (!open || !lockScroll) return;

    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [open, lockScroll]);

  // Escape key closes overlay
  useEffect(() => {
    if (!open || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`cr-shared-overlay ${className}`.trim()}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: backdropBlur ? 'blur(6px)' : 'none',
        WebkitBackdropFilter: backdropBlur ? 'blur(6px)' : 'none',
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: 'opacity 0.2s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Overlay;
