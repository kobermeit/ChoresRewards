import React, { Component, ErrorInfo, ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  level?: 'root' | 'section' | 'card';
  title?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Resilient Error Boundary component with granular fault isolation.
 * Prevents a single broken card, section, or widget from taking down the entire app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.level || 'generic'}] Caught error:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const level = this.props.level || 'section';

      // 1. Card-level: Compact inline card with alert styling
      if (level === 'card') {
        return (
          <div
            className="cr-card-error-fallback"
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--card-radius, 16px)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minHeight: 100,
              justifyContent: 'center',
              boxSizing: 'border-box',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <i className="fas fa-triangle-exclamation" style={{ color: '#ef4444' }} />
              <span>{this.props.title || 'Error displaying item'}</span>
            </div>
            <p style={{ margin: 0, color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.74rem' }}>
              {this.state.error?.message || 'Something went wrong rendering this item.'}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                alignSelf: 'flex-start',
                padding: '3px 10px',
                borderRadius: 'var(--radius-pill, 999px)',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '0.74rem',
                fontWeight: 700,
              }}
            >
              Retry
            </button>
          </div>
        );
      }

      // 2. Section-level: Centered message inside the page without breaking layout
      if (level === 'section') {
        return (
          <div
            className="cr-section-error-fallback"
            style={{
              padding: '24px 20px',
              borderRadius: 'var(--radius-lg, 18px)',
              background: 'rgba(30, 41, 59, 0.75)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f8fafc',
              textAlign: 'center',
              margin: '16px 0',
              backdropFilter: 'blur(8px)',
            }}
          >
            <i className="fas fa-exclamation-circle" style={{ fontSize: '2rem', color: '#ef4444', marginBottom: 10 }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 800 }}>
              {this.props.title || 'Something went wrong in this section'}
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: '#94a3b8' }}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--btn-radius, 10px)',
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.5)',
                color: '#38bdf8',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <i className="fas fa-rotate-right" style={{ marginRight: 6 }} /> Retry Section
            </button>
          </div>
        );
      }

      // 3. Root-level: Full fallback screen with reload option
      return (
        <div
          className="cr-root-error-fallback"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#f8fafc',
            padding: 24,
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <i className="fas fa-heart-crack" style={{ fontSize: '1.8rem', color: '#ef4444' }} />
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 800 }}>
            {this.props.title || 'ChoresRewards encountered an issue'}
          </h1>
          <p style={{ margin: '0 0 20px', maxWidth: 440, fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.4 }}>
            {this.state.error?.message || 'A component failed to render. You can reload or retry to resume.'}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--btn-radius, 10px)',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#f8fafc',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--btn-radius, 10px)',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
