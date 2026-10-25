import React from 'react';

export interface PointsBadgeProps {
  amount: number | string;
  isCash?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/**
 * Reusable, high-contrast currency/points pill.
 * Used on Chore cards, Reward cards, and other visual headers.
 */
export const PointsBadge: React.FC<PointsBadgeProps> = ({
  amount,
  isCash = false,
  className = '',
  style = {},
  title,
}) => {
  const numeric = Number(amount) || 0;
  const formatted = isCash
    ? `$${numeric.toFixed(2)}`
    : numeric % 1 === 0
      ? `${numeric.toFixed(0)} pt`
      : `${numeric.toFixed(1)} pt`;

  const borderCol = isCash ? 'rgba(74, 222, 128, 0.55)' : 'rgba(251, 191, 36, 0.55)';
  const textCol = isCash ? '#4ade80' : '#fbbf24';

  return (
    <div
      className={`cr-points-badge ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `1.5px solid ${borderCol}`,
        color: textCol,
        padding: '3px 9px',
        borderRadius: 'var(--radius-pill, 999px)',
        fontSize: '0.84rem',
        fontWeight: 900,
        letterSpacing: '0.2px',
        boxShadow: '0 3px 10px rgba(0, 0, 0, 0.55)',
        lineHeight: 1.2,
        ...style,
      }}
      title={title || (isCash ? 'Pocket Money' : 'Points Reward')}
    >
      <span style={{ fontSize: '0.82rem', lineHeight: 1 }}>{isCash ? '💵' : '⭐'}</span>
      <span>{formatted}</span>
    </div>
  );
};

export default PointsBadge;
