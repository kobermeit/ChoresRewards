import React, { useState, useEffect, useCallback } from 'react';

export interface DurationStepperProps {
  label?: React.ReactNode;
  totalSeconds: number;
  onChange: (newSeconds: number) => void;
  minSeconds?: number;
  maxSeconds?: number;
  stepSeconds?: number;
  disabled?: boolean;
  helperText?: React.ReactNode;
  style?: React.CSSProperties;
}

export const DurationStepper: React.FC<DurationStepperProps> = ({
  label,
  totalSeconds,
  onChange,
  minSeconds = 0,
  maxSeconds = 5999, // 99m 59s
  stepSeconds = 30,
  disabled = false,
  helperText,
  style,
}) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  // Local text input for manual typing (e.g. "02:30")
  const formatTime = (m: number, s: number) =>
    `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const [textVal, setTextVal] = useState(() => formatTime(mins, secs));

  useEffect(() => {
    setTextVal(formatTime(mins, secs));
  }, [mins, secs]);

  const handleStep = useCallback(
    (delta: number) => {
      if (disabled) return;
      const next = Math.max(minSeconds, Math.min(maxSeconds, totalSeconds + delta));
      onChange(next);
    },
    [totalSeconds, delta => delta, minSeconds, maxSeconds, disabled, onChange]
  );

  const handleBlur = () => {
    // Parse formats like "2:30", "02:30", "150", "2m", "30s"
    const trimmed = textVal.trim();
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      const m = parseInt(parts[0], 10) || 0;
      const s = parseInt(parts[1], 10) || 0;
      const total = Math.max(minSeconds, Math.min(maxSeconds, m * 60 + s));
      onChange(total);
      setTextVal(formatTime(Math.floor(total / 60), total % 60));
    } else {
      const parsed = parseInt(trimmed, 10);
      if (!isNaN(parsed)) {
        // If user typed e.g. "5", treat as 5 minutes if <= 60, else seconds
        const totalSecs = parsed <= 60 ? parsed * 60 : parsed;
        const total = Math.max(minSeconds, Math.min(maxSeconds, totalSecs));
        onChange(total);
        setTextVal(formatTime(Math.floor(total / 60), total % 60));
      } else {
        setTextVal(formatTime(mins, secs));
      }
    }
  };

  const isAtMin = totalSeconds <= minSeconds;
  const isAtMax = totalSeconds >= maxSeconds;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: '0.84rem',
            fontWeight: 700,
            color: 'var(--color-text-primary, #f8fafc)',
          }}
        >
          {label}
        </label>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        {/* -30s Button */}
        <button
          type="button"
          disabled={disabled || isAtMin}
          onClick={() => handleStep(-stepSeconds)}
          title={`Subtract ${stepSeconds} seconds`}
          aria-label={`Subtract ${stepSeconds} seconds`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 40,
            minWidth: 62,
            padding: '0 12px',
            background: isAtMin
              ? 'rgba(255, 255, 255, 0.03)'
              : 'rgba(255, 255, 255, 0.08)',
            border: `1.5px solid ${isAtMin ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.2)'}`,
            borderRadius: 10,
            color: isAtMin ? 'rgba(255, 255, 255, 0.3)' : '#f8fafc',
            fontSize: '0.88rem',
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: isAtMin || disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            userSelect: 'none',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
          }}
        >
          -{stepSeconds}s
        </button>

        {/* MM : SS Compact Input Field */}
        <input
          type="text"
          value={textVal}
          disabled={disabled}
          onChange={(e) => setTextVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleBlur();
              (e.target as HTMLInputElement).blur();
            }
          }}
          style={{
            width: 86,
            height: 40,
            textAlign: 'center',
            fontFamily: 'monospace',
            fontSize: '1.2rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: '#f8fafc',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1.5px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 10,
            outline: 'none',
            boxSizing: 'border-box',
            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
          }}
          title="Duration (MM:SS)"
          aria-label="Timer duration"
        />

        {/* +30s Button */}
        <button
          type="button"
          disabled={disabled || isAtMax}
          onClick={() => handleStep(stepSeconds)}
          title={`Add ${stepSeconds} seconds`}
          aria-label={`Add ${stepSeconds} seconds`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 40,
            minWidth: 62,
            padding: '0 12px',
            background: isAtMax
              ? 'rgba(255, 255, 255, 0.03)'
              : 'rgba(255, 255, 255, 0.08)',
            border: `1.5px solid ${isAtMax ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.2)'}`,
            borderRadius: 10,
            color: isAtMax ? 'rgba(255, 255, 255, 0.3)' : '#f8fafc',
            fontSize: '0.88rem',
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: isAtMax || disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            userSelect: 'none',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
          }}
        >
          +{stepSeconds}s
        </button>
      </div>

      {helperText && (
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
          {helperText}
        </span>
      )}
    </div>
  );
};
