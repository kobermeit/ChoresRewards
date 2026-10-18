import React from 'react';

export type BadgeColor = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
  icon?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  color = 'neutral',
  icon,
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <span
      className={`cr-badge cr-badge-${color} ${className}`.trim()}
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
