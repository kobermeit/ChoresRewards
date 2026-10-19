import React from 'react';

export interface WipBannerProps {
  message?: string;
  subtext?: string;
  style?: React.CSSProperties;
}

export const WipBanner: React.FC<WipBannerProps> = ({
  message = 'NOTE: Page not finished and may not work',
  subtext,
  style,
}) => {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 18px',
        marginBottom: 18,
        borderRadius: 'var(--radius-lg, 16px)',
        background: 'rgba(245, 158, 11, 0.12)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        boxShadow: '0 4px 16px rgba(245, 158, 11, 0.08)',
        color: '#fef3c7',
        fontSize: '0.88rem',
        ...style,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fbbf24',
          fontSize: '1rem',
          flexShrink: 0,
        }}
      >
        <i className="fas fa-triangle-exclamation" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, letterSpacing: '0.02em', color: '#fde68a' }}>
          {message}
        </div>
        {subtext && (
          <div style={{ fontSize: '0.78rem', color: '#fef3c7', opacity: 0.85, marginTop: 2 }}>
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
};
