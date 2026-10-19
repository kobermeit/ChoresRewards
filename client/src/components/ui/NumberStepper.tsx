import React, { useCallback } from 'react';

export interface NumberStepperProps {
  label?: React.ReactNode;
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  presets?: number[];
  presetsUnit?: string;
  buttonsPosition?: 'right' | 'sides';
  disabled?: boolean;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  style?: React.CSSProperties;
  inputWidth?: number | string;
  required?: boolean;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  prefix,
  suffix,
  presets,
  presetsUnit = '',
  buttonsPosition = 'right',
  disabled = false,
  helperText,
  error,
  style,
  inputWidth = 84,
  required = false,
}) => {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;

  const handleDecrement = useCallback(() => {
    if (disabled) return;
    const next = Math.round((numValue - step) * 100) / 100;
    if (min !== undefined && next < min) return;
    onChange(next);
  }, [numValue, step, min, disabled, onChange]);

  const handleIncrement = useCallback(() => {
    if (disabled) return;
    const next = Math.round((numValue + step) * 100) / 100;
    if (max !== undefined && next > max) return;
    onChange(next);
  }, [numValue, step, max, disabled, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(min !== undefined ? min : 0);
      return;
    }
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      if (min !== undefined && parsed < min) return onChange(min);
      if (max !== undefined && parsed > max) return onChange(max);
      onChange(parsed);
    }
  };

  const isAtMin = min !== undefined && numValue <= min;
  const isAtMax = max !== undefined && numValue >= max;

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
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Main Stepper Control */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(30, 41, 59, 0.7)',
            border: error
              ? '1px solid #ef4444'
              : '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 'var(--input-radius, 12px)',
            overflow: 'hidden',
            height: 42,
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2)',
            transition: 'border-color 0.15s ease',
          }}
        >
          {/* Side Decrement Button (if buttonsPosition === 'sides') */}
          {buttonsPosition === 'sides' && (
            <button
              type="button"
              disabled={disabled || isAtMin}
              onClick={handleDecrement}
              style={{
                width: 40,
                height: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                color: isAtMin ? 'rgba(255, 255, 255, 0.25)' : '#cbd5e1',
                fontSize: '1.1rem',
                cursor: isAtMin ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Decrease"
              aria-label="Decrease value"
            >
              <i className="fas fa-minus" style={{ fontSize: '0.85rem' }} />
            </button>
          )}

          {/* Dedicated Non-Overlapping Prefix Slot */}
          {prefix && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 10px 0 12px',
                color: '#fbbf24',
                fontSize: '1rem',
                flexShrink: 0,
                pointerEvents: 'none',
              }}
            >
              {prefix}
            </div>
          )}

          {/* Number Input Field */}
          <input
            type="number"
            value={value}
            onChange={handleInputChange}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            style={{
              width: inputWidth,
              height: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '1.05rem',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              textAlign: prefix ? 'left' : 'center',
              padding: prefix ? '0 8px 0 0' : '0 8px',
              MozAppearance: 'textfield',
            }}
          />

          {/* Suffix (e.g. mins, days, pts) */}
          {suffix && (
            <span
              style={{
                fontSize: '0.82rem',
                color: '#94a3b8',
                fontWeight: 600,
                paddingRight: buttonsPosition === 'right' ? 8 : 12,
                userSelect: 'none',
              }}
            >
              {suffix}
            </span>
          )}

          {/* Right Stepper Buttons (if buttonsPosition === 'right') */}
          {buttonsPosition === 'right' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                height: '100%',
              }}
            >
              <button
                type="button"
                disabled={disabled || isAtMin}
                onClick={handleDecrement}
                style={{
                  width: 38,
                  height: '100%',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: 'none',
                  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                  color: isAtMin ? 'rgba(255, 255, 255, 0.25)' : '#cbd5e1',
                  cursor: isAtMin ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  transition: 'background 0.15s ease',
                }}
                title="Decrease"
                aria-label="Decrease value"
              >
                <i className="fas fa-minus" />
              </button>
              <button
                type="button"
                disabled={disabled || isAtMax}
                onClick={handleIncrement}
                style={{
                  width: 38,
                  height: '100%',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: 'none',
                  color: isAtMax ? 'rgba(255, 255, 255, 0.25)' : '#cbd5e1',
                  cursor: isAtMax ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  transition: 'background 0.15s ease',
                }}
                title="Increase"
                aria-label="Increase value"
              >
                <i className="fas fa-plus" />
              </button>
            </div>
          )}

          {/* Side Increment Button (if buttonsPosition === 'sides') */}
          {buttonsPosition === 'sides' && (
            <button
              type="button"
              disabled={disabled || isAtMax}
              onClick={handleIncrement}
              style={{
                width: 40,
                height: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                color: isAtMax ? 'rgba(255, 255, 255, 0.25)' : '#cbd5e1',
                fontSize: '1.1rem',
                cursor: isAtMax ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Increase"
              aria-label="Increase value"
            >
              <i className="fas fa-plus" style={{ fontSize: '0.85rem' }} />
            </button>
          )}
        </div>

        {/* Quick Tap Preset Pills */}
        {presets && presets.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {presets.map((preset) => {
              const active = numValue === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange(preset)}
                  style={{
                    padding: '4px 10px',
                    minWidth: 34,
                    height: 32,
                    borderRadius: 'var(--radius-sm, 8px)',
                    border: active
                      ? '1.5px solid var(--color-primary-highlight, #38bdf8)'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                    background: active
                      ? 'rgba(56, 189, 248, 0.22)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: active ? '#ffffff' : '#cbd5e1',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {preset}
                  {presetsUnit}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error ? (
        <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 600 }}>{error}</span>
      ) : helperText ? (
        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #94a3b8)' }}>{helperText}</span>
      ) : null}
    </div>
  );
};
