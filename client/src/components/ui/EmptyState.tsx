import React from 'react';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'fas fa-inbox',
  title,
  description,
  children,
  style,
  className = '',
}) => {
  return (
    <div
      className={`empty-state-container ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Visual Icon Badge */}
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(30, 41, 59, 0.6) 100%)',
          border: '1.5px dashed rgba(148, 163, 184, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
          boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.35)',
        }}
      >
        <i
          className={icon}
          style={{
            fontSize: '2rem',
            color: '#60a5fa',
            opacity: 0.9,
          }}
        />
      </div>

      {/* Title */}
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: '1.2rem',
          fontWeight: 700,
          color: '#f8fafc',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          style={{
            margin: '0 0 22px',
            fontSize: '0.88rem',
            color: '#94a3b8',
            maxWidth: 420,
            lineHeight: 1.55,
          }}
        >
          {description}
        </p>
      )}

      {/* Optional action buttons or custom slot */}
      {children && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};
