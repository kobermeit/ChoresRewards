import React from 'react';

export interface TimerDurationOption {
  minutes: number;
  seconds: number;
  label: string;
}

export const TIMER_DURATION_OPTIONS: readonly TimerDurationOption[] = [
  { minutes: 0.5, seconds: 30, label: '30 seconds' },
  { minutes: 1, seconds: 60, label: '1 minute' },
  { minutes: 2, seconds: 120, label: '2 minutes' },
  { minutes: 3, seconds: 180, label: '3 minutes' },
  { minutes: 5, seconds: 300, label: '5 minutes' },
  { minutes: 10, seconds: 600, label: '10 minutes' },
  { minutes: 15, seconds: 900, label: '15 minutes' },
  { minutes: 20, seconds: 1200, label: '20 minutes' },
  { minutes: 30, seconds: 1800, label: '30 minutes' },
] as const;

export interface TimerDurationSelectProps {
  value: number;
  onChange: (value: number) => void;
  unit?: 'minutes' | 'seconds';
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  name?: string;
}

/**
 * Reusable timer duration dropdown with standardized generic duration options.
 * Can be shared across settings, visual timer, and chore duration configuration.
 */
export const TimerDurationSelect: React.FC<TimerDurationSelectProps> = ({
  value,
  onChange,
  unit = 'minutes',
  disabled = false,
  className = '',
  style,
  id,
  name,
}) => {
  const currentVal = unit === 'seconds' ? value : value;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = Number(e.target.value);
    onChange(raw);
  };

  return (
    <select
      id={id}
      name={name}
      disabled={disabled}
      className={`timer-duration-select ${className}`}
      value={currentVal}
      onChange={handleChange}
      style={{
        background: 'rgba(0, 0, 0, 0.45)',
        color: '#f8fafc',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: 8,
        padding: '5px 10px',
        fontSize: '0.85rem',
        fontWeight: 600,
        outline: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {TIMER_DURATION_OPTIONS.map((opt) => {
        const optVal = unit === 'seconds' ? opt.seconds : opt.minutes;
        return (
          <option key={optVal} value={optVal} style={{ background: '#0f172a', color: '#f8fafc' }}>
            {opt.label}
          </option>
        );
      })}
    </select>
  );
};
