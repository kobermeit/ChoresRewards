import React from 'react';

interface FormErrorAlertProps {
  error: string | null | undefined;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}

export const FormErrorAlert: React.FC<FormErrorAlertProps> = ({ error, onDismiss, style }) => {
  if (!error) return null;

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 10,
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        color: '#fca5a5',
        fontSize: '0.88rem',
        lineHeight: 1.45,
        marginBottom: 16,
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)',
        ...style,
      }}
    >
      <i
        className="fas fa-circle-exclamation"
        style={{
          color: '#ef4444',
          fontSize: '1.1rem',
          marginTop: 2,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, fontWeight: 500 }}>
        {error}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#f87171',
            cursor: 'pointer',
            padding: 0,
            fontSize: '1rem',
            lineHeight: 1,
            opacity: 0.8,
            transition: 'opacity 0.15s',
          }}
          title="Dismiss error"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
};
