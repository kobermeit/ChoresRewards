import React, { forwardRef } from 'react';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
/** Shadow depth, 0 (flat) … 3 (floating). */
export type CardElevation = 0 | 1 | 2 | 3;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: CardPadding;
  elevation?: CardElevation;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = false, padding = 'md', elevation, children, className = '', style, ...props }, ref) => {
    const paddingMap: Record<CardPadding, string> = {
      none: '0',
      sm: '12px 14px',
      md: '18px 20px',
      lg: '24px 28px',
    };

    return (
      <div
        ref={ref}
        className={`cr-card ${interactive ? 'cr-card-interactive' : ''} ${
          elevation !== undefined ? `cr-card-elev-${elevation}` : ''
        } ${className}`.trim()}
        style={{ padding: paddingMap[padding], ...style }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
