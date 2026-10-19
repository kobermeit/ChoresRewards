import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonShape = 'default' | 'pill' | 'circle' | 'square';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
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
      shape = 'default',
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
    const isIconOnly = !children && Boolean(icon);
    const shapeClass = isIconOnly
      ? shape === 'circle'
        ? 'cr-btn-icon-only cr-btn-rounded-full'
        : 'cr-btn-icon-only'
      : shape === 'pill'
      ? 'cr-btn-pill'
      : '';
    const widthStyle = fullWidth ? { width: '100%' } : {};

    return (
      <button
        ref={ref}
        type="button"
        className={`cr-btn ${variantClass} ${sizeClass} ${shapeClass} ${className}`.trim()}
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
        {children && <span className="cr-btn-content">{children}</span>}
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

export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: string;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ shape = 'square', ...props }, ref) => {
    return <Button ref={ref} shape={shape} {...props} />;
  }
);

IconButton.displayName = 'IconButton';

export interface PillButtonProps extends ButtonProps {}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  (props, ref) => {
    return <Button ref={ref} shape="pill" {...props} />;
  }
);

PillButton.displayName = 'PillButton';
