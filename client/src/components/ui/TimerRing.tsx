import React from 'react';

export interface TimerRingProps {
  /** Remaining fraction, 0..1 */
  fraction: number;
  color: string;
  /** Main text (e.g. "9:45") */
  label: string;
  /** Small caption under the label */
  caption?: string;
  strokeWidth?: number;
  onClick?: () => void;
  title?: string;
}

/**
 * Thin circular countdown ring. Fully scalable: the SVG (including its text) is drawn in a
 * 100x100 viewBox and sized to the largest square that fits its container, so it adapts to
 * whatever space the parent gives it (no fixed pixel sizes).
 */
export const TimerRing: React.FC<TimerRingProps> = ({
  fraction,
  color,
  label,
  caption,
  strokeWidth = 5,
  onClick,
  title,
}) => {
  const radius = 50 - strokeWidth / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, fraction));
  const offset = circumference - clamped * circumference;

  return (
    <div
      className="cr-timer-ring"
      onClick={onClick}
      title={title}
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        width: '100%',
        height: '100%',
        containerType: 'size',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 'min(100cqw, 100cqh, 100%)',
          maxHeight: 'min(100cqw, 100cqh, 100%)',
          aspectRatio: '1 / 1',
          display: 'block',
        }}
        role="img"
        aria-label={`${label} ${caption || ''}`.trim()}
      >
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
        <text
          x="50"
          y={caption ? 52 : 57}
          textAnchor="middle"
          fill="#ffffff"
          fontSize="22"
          fontWeight="900"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {label}
        </text>
        {caption && (
          <text
            x="50"
            y="66"
            textAnchor="middle"
            fill={color}
            fontSize="8"
            fontWeight="700"
            letterSpacing="0.5"
            style={{ textTransform: 'uppercase' }}
          >
            {caption}
          </text>
        )}
      </svg>
    </div>
  );
};

export default TimerRing;
