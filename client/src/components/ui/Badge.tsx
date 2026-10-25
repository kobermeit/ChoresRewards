import React from 'react';

export type BadgeColor = 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
  variant?: BadgeColor | string;
  icon?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  color = 'neutral',
  variant,
  icon,
  children,
  className = '',
  style,
  ...props
}) => {
  const badgeColor = (variant as BadgeColor) || color || 'neutral';
  return (
    <span
      className={`cr-badge cr-badge-${badgeColor} ${className}`.trim()}
      style={style}
      {...props}
    >
      {icon && (
        <span aria-hidden="true">
          {icon.startsWith('fa') || icon.includes(' ') ? <i className={icon} /> : icon}
        </span>
      )}
      {children}
    </span>
  );
};
