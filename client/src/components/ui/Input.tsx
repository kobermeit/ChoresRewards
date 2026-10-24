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

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
  options?: SelectOption[];
  containerStyle?: React.CSSProperties;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, children, className = '', id, style, containerStyle, value, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const isUnselected = value === '' || value === undefined || value === null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', ...containerStyle }}>
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
        <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
          <select
            ref={ref}
            id={selectId}
            value={value}
            className={`cr-select ${isUnselected ? 'cr-select-placeholder' : ''} ${className}`.trim()}
            style={{
              borderColor: error ? 'var(--color-danger-border)' : undefined,
              color: isUnselected ? 'var(--color-text-muted, #94a3b8)' : undefined,
              paddingRight: 36,
              backgroundImage: 'none',
              ...style,
            }}
            {...props}
          >
            {placeholder && (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            )}
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: isUnselected ? 'var(--color-text-muted, #94a3b8)' : '#94a3b8',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.7,
            }}
            aria-hidden="true"
          >
            <i className="fas fa-chevron-down" />
          </div>
        </div>
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

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, style, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        {label && (
          <label
            htmlFor={textareaId}
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
        <textarea
          ref={ref}
          id={textareaId}
          className={`cr-input ${className}`.trim()}
          style={{
            borderColor: error ? 'var(--color-danger-border)' : undefined,
            minHeight: 80,
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: 1.5,
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

Textarea.displayName = 'Textarea';
