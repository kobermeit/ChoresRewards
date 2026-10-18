import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string; // FontAwesome or emoji
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      icon,
      iconPosition = 'left',
      isLoading = false,
      fullWidth = false,
      children,
      className = '',
      style,
      disabled,
      ...props
    },
    ref
  ) => {
    const variantClass = `cr-btn-${variant}`;
    const sizeClass = `cr-btn-${size}`;
    const widthStyle = fullWidth ? { width: '100%' } : {};

    return (
      <button
        ref={ref}
        type="button"
        className={`cr-btn ${variantClass} ${sizeClass} ${className}`.trim()}
        style={{ ...widthStyle, ...style }}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading && <i className="fas fa-spinner fa-spin" aria-hidden="true" />}
        {!isLoading && icon && iconPosition === 'left' && (
          <span className="cr-btn-icon" aria-hidden="true">
            {icon.startsWith('fa') || icon.includes(' ') ? <i className={icon} /> : icon}
          </span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && icon && iconPosition === 'right' && (
          <span className="cr-btn-icon" aria-hidden="true">
            {icon.startsWith('fa') || icon.includes(' ') ? <i className={icon} /> : icon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
