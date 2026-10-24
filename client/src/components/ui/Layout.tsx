import React from 'react';

// ============================================================================
// 1. CONTAINER
// ============================================================================
export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxWidth?: string | number;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth,
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`cr-container ${className}`.trim()}
      style={{
        ...(maxWidth ? { maxWidth } : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

// ============================================================================
// 2. RESPONSIVE GRID
// ============================================================================
export interface ResponsiveGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  minColWidth?: string;
  gap?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  minColWidth = '260px',
  gap,
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`cr-grid ${className}`.trim()}
      style={{
        ['--grid-min-col' as any]: minColWidth,
        ['--grid-gap' as any]: gap,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

// ============================================================================
// 3. FORM GRID & FIELD
// ============================================================================
export interface FormGridProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
  gap?: string;
}

export const FormGrid: React.FC<FormGridProps> = ({
  children,
  gap,
  className = '',
  style,
  ...props
}) => {
  return (
    <form
      className={`cr-form-grid ${className}`.trim()}
      style={{
        ...(gap ? { gap } : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </form>
  );
};

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  colSpan?: 12 | 10 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2;
  label?: string;
  help?: string;
  error?: string | null;
}

export const FormField: React.FC<FormFieldProps> = ({
  children,
  colSpan = 12,
  label,
  help,
  error,
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`cr-col-${colSpan} ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
        maxWidth: '100%',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {label && (
        <label
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--color-text-primary, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {label}
        </label>
      )}
      {children}
      {help && (
        <span style={{ fontSize: '0.78rem', opacity: 0.7, color: 'var(--color-text-muted, #94a3b8)', lineHeight: 1.4 }}>
          {help}
        </span>
      )}
      {error && (
        <span style={{ fontSize: '0.78rem', color: 'var(--color-danger-border, #ef4444)', fontWeight: 600 }}>
          {error}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// 4. STACK & CLUSTER
// ============================================================================
export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  gap?: string;
}

export const Stack: React.FC<StackProps> = ({
  children,
  gap,
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`cr-stack ${className}`.trim()}
      style={{
        ...(gap ? { gap } : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export interface ClusterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  gap?: string;
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
}

export const Cluster: React.FC<ClusterProps> = ({
  children,
  gap,
  justify = 'flex-start',
  align = 'center',
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`cr-cluster ${className}`.trim()}
      style={{
        ...(gap ? { gap } : {}),
        justifyContent: justify,
        alignItems: align,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
