import React from 'react';

export type CardShellTone = 'default' | 'overdue' | 'completed';

export interface CardShellProps {
  children: React.ReactNode;
  /** Member accent colour (hex) used for the border / glow. */
  accentColor?: string | null;
  tone?: CardShellTone;
  /** Overrides border colour (e.g. timer state colour). */
  borderColor?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

/**
 * Single source of truth for card chrome (border, radius, shadow, sizing).
 * Every item card face (front, timer back, ...) renders inside this shell so
 * they always share the same size rules: fill the grid cell, never set their own height.
 */
export const CardShell: React.FC<CardShellProps> = ({
  children,
  accentColor,
  tone = 'default',
  borderColor,
  className = '',
  style,
  onClick,
}) => {
  const memberBorder = accentColor ? `${accentColor}38` : 'rgba(255, 255, 255, 0.12)';
  const memberTop = accentColor ? `${accentColor}cc` : 'rgba(255, 255, 255, 0.22)';

  const side = borderColor
    ? `${borderColor}66`
    : tone === 'overdue'
      ? 'rgba(239, 68, 68, 0.85)'
      : tone === 'completed'
        ? 'rgba(16, 185, 129, 0.55)'
        : memberBorder;
  const top = borderColor
    ? borderColor
    : tone === 'overdue'
      ? '#ef4444'
      : tone === 'completed'
        ? '#10b981'
        : memberTop;
  const glow = borderColor || accentColor;

  return (
    <div
      className={`cr-item-card ${tone === 'completed' ? 'cr-item-card-completed' : ''} ${className}`.trim()}
      style={{
        background: 'linear-gradient(150deg, #24344d 0%, #152238 100%)',
        border: `1.5px solid ${side}`,
        borderTop: `2.5px solid ${top}`,
        borderRadius: 'var(--card-radius, 16px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: glow
          ? `0 6px 20px rgba(0, 0, 0, 0.4), 0 0 16px ${glow}18`
          : '0 6px 20px rgba(0, 0, 0, 0.35)',
        boxSizing: 'border-box',
        width: '100%',
        position: 'relative',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default CardShell;
