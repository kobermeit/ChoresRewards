import React from 'react';
import { SectionHelpTip } from '../HelpTooltipAndView';
import { useSeason } from '../../hooks/useSettings';

function getSeasonalIcon(key?: string): string {
  switch (key) {
    case 'spring': return 'fas fa-seedling';
    case 'summer': return 'fas fa-sun';
    case 'autumn': return 'fas fa-leaf';
    case 'winter': return 'fas fa-snowflake';
    case 'halloween': return 'fas fa-ghost';
    case 'christmas': return 'fas fa-gift';
    case 'easter': return 'fas fa-egg';
    case 'new_year': return 'fas fa-star';
    default: return 'fas fa-wand-magic-sparkles';
  }
}

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
  const seasonalKey = (seasonInfo.event?.key || seasonInfo.season?.key || seasonInfo.theme?.key || '').toLowerCase();
  const seasonalIcon = isThemed ? getSeasonalIcon(seasonalKey) : null;

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
        {isThemed && (
          <div
            className="page-header-seasonal-emblem"
            style={{
              position: 'absolute',
              right: 18,
              top: 20,
              fontSize: '4.2rem',
              opacity: 0.14,
              pointerEvents: 'none',
              userSelect: 'none',
              lineHeight: 1,
              zIndex: 0,
            }}
            aria-hidden="true"
          >
            {seasonInfo.emoji || (seasonalIcon ? <i className={seasonalIcon} /> : '✨')}
          </div>
        )}
        <div
          className="page-header-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'nowrap',
            gap: 8,
            marginBottom: toolbar ? 12 : 16,
            position: 'relative',
            zIndex: 1,
            minWidth: 0,
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
            <h2
              className="section-title page-container-title"
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--color-text-primary, #f8fafc)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {icon && (
                <i
                  className={`${icon} ${iconClass}`.trim()}
                  style={{
                    flexShrink: 0,
                    ...(isThemed ? { color: seasonAccent } : {}),
                  }}
                />
              )}
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                }}
              >
                {title}
              </span>
              {isThemed && seasonalIcon && (
                <i
                  className={`${seasonalIcon} page-header-seasonal-suffix`}
                  style={{
                    fontSize: '1rem',
                    color: seasonAccent,
                    opacity: 0.9,
                    flexShrink: 0,
                  }}
                  title={seasonInfo.theme?.name || undefined}
                  aria-hidden="true"
                />
              )}
            </h2>
            {badge && (
              <div className="page-header-badge" style={{ flexShrink: 0 }}>
                {badge}
              </div>
            )}
            {helpTip && (
              <div style={{ flexShrink: 0 }}>
                <SectionHelpTip
                  title={helpTip.title || title}
                  tips={helpTip.tips}
                  text={helpTip.text}
                />
              </div>
            )}
          </div>
          {actions && (
            <div className="page-header-actions" style={{ flexShrink: 0 }}>
              {actions}
            </div>
          )}
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
        {isThemed && (
          <div
            className="page-header-seasonal-emblem"
            style={{
              position: 'absolute',
              right: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '4.5rem',
              opacity: 0.14,
              pointerEvents: 'none',
              userSelect: 'none',
              lineHeight: 1,
              zIndex: 0,
            }}
            aria-hidden="true"
          >
            {seasonInfo.emoji || (seasonalIcon ? <i className={seasonalIcon} /> : '✨')}
          </div>
        )}

        {/* Tier 1: Title, Icon & Top-Right Actions */}
        <div
          className="page-header-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'nowrap',
            gap: 10,
            position: 'relative',
            zIndex: 1,
            minWidth: 0,
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
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
            <div style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <h1
                  className="page-container-title"
                  style={{
                    margin: 0,
                    fontSize: '1.45rem',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: '#f8fafc',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                    }}
                  >
                    {title}
                  </span>
                  {isThemed && seasonalIcon && (
                    <i
                      className={`${seasonalIcon} page-header-seasonal-suffix`}
                      style={{
                        fontSize: '1.15rem',
                        color: seasonAccent,
                        opacity: 0.9,
                        flexShrink: 0,
                      }}
                      title={seasonInfo.theme?.name || undefined}
                      aria-hidden="true"
                    />
                  )}
                </h1>
                {badge && (
                  <div className="page-header-badge" style={{ flexShrink: 0 }}>
                    {badge}
                  </div>
                )}
                {helpTip && (
                  <div style={{ flexShrink: 0 }}>
                    <SectionHelpTip
                      title={helpTip.title || title}
                      tips={helpTip.tips}
                      text={helpTip.text}
                    />
                  </div>
                )}
              </div>
              {subtitle && (
                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: '0.82rem',
                    color: '#94a3b8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
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
