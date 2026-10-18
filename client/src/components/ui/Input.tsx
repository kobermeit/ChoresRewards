import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: 'sm' | 'md';
  label?: string;
  error?: string | null;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = 'md', label, error, helperText, className = '', id, style, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: '0.84rem',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`cr-input ${inputSize === 'sm' ? 'cr-input-sm' : ''} ${className}`.trim()}
          style={{
            borderColor: error ? 'var(--color-danger-border)' : undefined,
            ...style,
          }}
          {...props}
        />
        {error && (
          <span style={{ fontSize: '0.78rem', color: 'var(--color-danger-border)', fontWeight: 600 }}>
            {error}
          </span>
        )}
        {!error && helperText && (
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, children, className = '', id, style, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        {label && (
          <label
            htmlFor={selectId}
            style={{
              fontSize: '0.84rem',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`cr-select ${className}`.trim()}
          style={{
            borderColor: error ? 'var(--color-danger-border)' : undefined,
            ...style,
          }}
          {...props}
        >
          {children}
        </select>
        {error && (
          <span style={{ fontSize: '0.78rem', color: 'var(--color-danger-border)', fontWeight: 600 }}>
            {error}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
