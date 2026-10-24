import React from 'react';
import { SectionHelpTip } from '../HelpTooltipAndView';
import { useSeason } from '../../hooks/useSettings';

export interface PageContainerProps {
  id?: string;
  title: string;
  subtitle?: string;
  icon?: string;                 // FontAwesome icon class e.g. "fas fa-house-chimney"
  iconClass?: string;           // Semantic icon color class e.g. "section-icon-chores"
  badge?: React.ReactNode;      // Optional badge pill next to title
  helpTip?: {
    title?: string;
    tips?: string[];
    text?: string;
  };
  actions?: React.ReactNode;    // Top-right actions slot (e.g. "+ Add Chore" button)
  toolbar?: React.ReactNode;    // 2nd subheader tier (e.g. Family member filter pill bar)
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  boxed?: boolean;              // Set to true if an embedded card box is needed; defaults to false (unboxed full-page like Calendar)
}

export const PageContainer: React.FC<PageContainerProps> = ({
  id,
  title,
  subtitle,
  icon,
  iconClass = '',
  badge,
  helpTip,
  actions,
  toolbar,
  children,
  className = '',
  style = {},
  boxed = false,
}) => {
  const seasonInfo = useSeason();
  const isThemed = seasonInfo.enabled && Boolean(seasonInfo.theme);
  const seasonAccent = seasonInfo.accent || '#3b82f6';

  if (boxed) {
    return (
      <section
        id={id}
        className={`page-container-section ${className}`.trim()}
        style={{
          margin: '1rem',
          padding: '1.5rem',
          background: isThemed
            ? `linear-gradient(135deg, ${seasonAccent}1c 0%, var(--cr-surface-2) 100%)`
            : 'linear-gradient(135deg, var(--cr-surface-1) 0%, var(--cr-surface-2) 100%)',
          border: isThemed
            ? `1px solid ${seasonAccent}44`
            : '1px solid var(--cr-surface-border)',
          borderRadius: 'var(--card-radius, 16px)',
          boxShadow: isThemed
            ? `0 4px 20px var(--cr-shadow), 0 0 15px ${seasonAccent}18`
            : '0 4px 20px var(--cr-shadow)',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
          ...style,
        }}
      >
        <div
          className="page-header-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: toolbar ? 12 : 16,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2
              className="section-title page-container-title"
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--color-text-primary, #f8fafc)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {icon && (
                <i
                  className={`${icon} ${iconClass}`.trim()}
                  style={isThemed ? { color: seasonAccent } : undefined}
                />
              )}
              <span>{title}</span>
            </h2>
            {badge && <div className="page-header-badge">{badge}</div>}
            {helpTip && (
              <SectionHelpTip
                title={helpTip.title || title}
                tips={helpTip.tips}
                text={helpTip.text}
              />
            )}
          </div>
          {actions && <div className="page-header-actions">{actions}</div>}
        </div>
        {toolbar && <div className="page-header-toolbar" style={{ marginBottom: 16, position: 'relative', zIndex: 1 }}>{toolbar}</div>}
        <div className="page-container-body" style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </section>
    );
  }

  // Standalone Full-Page Layout (Matches CalendarView design)
  return (
    <div
      id={id}
      className={`page-view-container ${className}`.trim()}
      style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '16px 20px 64px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Floating Glass Header Bar */}
      <div
        className="page-header-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 20,
          background: isThemed
            ? `linear-gradient(135deg, ${seasonAccent}1c 0%, rgba(15, 23, 42, 0.7) 100%)`
            : 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '14px 20px',
          borderRadius: 16,
          border: isThemed
            ? `1px solid ${seasonAccent}44`
            : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: isThemed
            ? `0 4px 20px rgba(0, 0, 0, 0.2), 0 0 16px ${seasonAccent}1a`
            : '0 4px 20px rgba(0, 0, 0, 0.15)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Tier 1: Title, Icon & Top-Right Actions */}
        <div
          className="page-header-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {icon && (
              <div
                className="page-header-icon-box"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: isThemed ? `${seasonAccent}25` : 'rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  border: isThemed
                    ? `1px solid ${seasonAccent}55`
                    : '1px solid rgba(255, 255, 255, 0.12)',
                  flexShrink: 0,
                  boxShadow: isThemed ? `0 0 10px ${seasonAccent}2a` : undefined,
                }}
              >
                <i
                  className={`${icon} ${iconClass}`.trim()}
                  style={isThemed ? { color: seasonAccent } : undefined}
                />
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1
                  className="page-container-title"
                  style={{
                    margin: 0,
                    fontSize: '1.45rem',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: '#f8fafc',
                  }}
                >
                  {title}
                </h1>
                {badge && <div className="page-header-badge">{badge}</div>}
                {helpTip && (
                  <SectionHelpTip
                    title={helpTip.title || title}
                    tips={helpTip.tips}
                    text={helpTip.text}
                  />
                )}
              </div>
              {subtitle && (
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div
              className="page-header-actions"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginLeft: 'auto',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {actions}
            </div>
          )}
        </div>

        {/* Tier 2: Subheader / Toolbar (Filter pills, tabs, etc.) */}
        {toolbar && (
          <div
            className="page-header-toolbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              flexWrap: 'wrap',
              gap: 8,
              paddingTop: 10,
              borderTop: isThemed
                ? `1px solid ${seasonAccent}25`
                : '1px solid rgba(255, 255, 255, 0.07)',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {toolbar}
          </div>
        )}
      </div>

      {/* Page Content Body (Directly on canvas) */}
      <div className="page-container-body">{children}</div>
    </div>
  );
};

export default PageContainer;
