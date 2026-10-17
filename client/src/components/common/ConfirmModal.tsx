import React, { useEffect } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          color: '#f8fafc',
          animation: 'crModalFadeIn 0.18s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: danger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
              color: danger ? '#f87171' : '#60a5fa',
              fontSize: '1.25rem',
              flexShrink: 0,
            }}
          >
            <i className={`fas ${danger ? 'fa-exclamation-triangle' : 'fa-info-circle'}`} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc' }}>
              {title}
            </h3>
          </div>
        </div>

        <p
          style={{
            margin: '4px 0 8px',
            fontSize: '0.95rem',
            color: '#cbd5e1',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '8px',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#e2e8f0',
              fontWeight: 500,
              fontSize: '0.92rem',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              background: danger ? '#dc2626' : '#2563eb',
              border: 'none',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.92rem',
              cursor: 'pointer',
              boxShadow: danger
                ? '0 4px 12px rgba(220, 38, 38, 0.35)'
                : '0 4px 12px rgba(37, 99, 235, 0.35)',
              transition: 'transform 0.12s ease, filter 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1.0)')}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
