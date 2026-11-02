import React, { forwardRef } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'warning'
  | 'outline'
  | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonShape = 'default' | 'pill' | 'circle' | 'square';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  icon?: string; // FontAwesome or emoji
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  /** Alias of `isLoading`, kept because plenty of call sites use it. */
  loading?: boolean;
  fullWidth?: boolean;
  collapseOnMobile?: boolean; // When true (default when icon present), hides label text on mobile (<768px) keeping only the icon
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
      loading,
      fullWidth = false,
      collapseOnMobile = true,
      children,
      className = '',
      style,
      disabled,
      title,
      ...props
    },
    ref
  ) => {
    const variantClass = `cr-btn-${variant}`;
    const sizeClass = `cr-btn-${size}`;
    const busy = isLoading || Boolean(loading);
    const isIconOnly = !children && Boolean(icon);
    const collapseClass = collapseOnMobile && icon && children ? 'cr-btn-collapse-mobile' : '';
    const autoTitle = title || (typeof children === 'string' ? children : undefined);
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
        className={`cr-btn ${variantClass} ${sizeClass} ${shapeClass} ${collapseClass} ${className}`.trim()}
        style={{ ...widthStyle, ...style }}
        disabled={disabled || busy}
        aria-busy={busy}
        title={autoTitle}
        aria-label={props['aria-label'] || autoTitle}
        {...props}
      >
        {busy && <i className="fas fa-spinner fa-spin" aria-hidden="true" />}
        {!busy && icon && iconPosition === 'left' && (
          <span className="cr-btn-icon" aria-hidden="true">
            {icon.startsWith('fa') || icon.includes(' ') ? <i className={icon} /> : icon}
          </span>
        )}
        {children && <span className="cr-btn-content">{children}</span>}
        {!busy && icon && iconPosition === 'right' && (
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

export interface PillButtonProps extends ButtonProps {
  /** Renders the pill as the pressed/active option of a filter row. */
  selected?: boolean;
}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ selected = false, className = '', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        shape="pill"
        aria-pressed={selected}
        className={`${selected ? 'is-selected' : ''} ${className}`.trim()}
        {...props}
      />
    );
  }
);

PillButton.displayName = 'PillButton';
