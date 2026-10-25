import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAssetUrl, resolveAvatarUrl } from '../api';
import { useSeason, useUiPref } from '../hooks/useSettings';
import { useAppDispatch } from '../store';
import { toggleMobileDrawer } from '../store/uiSlice';
import { ClockWidget } from '../features/header/ClockWidget';
import { WeatherWidget } from '../features/header/WeatherWidget';

export const Header: React.FC = () => {
  const {
    data,
    lastFetchedAt,
    theme,
    toggleTheme,
    muted,
    toggleMute,
    adultMode,
    setAdultMode,
    openAdultPinModal,
    activeUser,
    setProfileSwitcherOpen,
    isParent,
    isChild,
    isFamily,
    setActiveView,
    scrollToSection,
    showToast,
    setScreensaverOpen,
    setVisualTimerOpen,
    timerRunning,
    timerRemainingSeconds,
  } = useApp();

  const [headerMinimized] = useUiPref('headerMinimized');
  const dispatch = useAppDispatch();
  const seasonInfo = useSeason();
  const isThemed = seasonInfo.enabled && Boolean(seasonInfo.theme);
  const seasonAccent = seasonInfo.accent || '#3b82f6';

  // Notifications & Quick Add dropdowns
  const [notifOpen, setNotifOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [notifs, setNotifs] = useState<{
    alerts: any[];
    recent: any[];
    alert_count: number;
    overdue_count: number;
  }>({
    alerts: [],
    recent: [],
    alert_count: 0,
    overdue_count: 0,
  });

  // Notifications polling
  useEffect(() => {
    const fetchNotifs = () => {
      apiGet('notifications')
        .then((res) => {
          if (res?.success) {
            setNotifs(res);
          }
        })
        .catch(() => {});
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, [data?.chores, adultMode]);

function formatAestDateTime(date: Date | null | undefined): string {
  if (!date) return 'Not yet fetched';
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    return (
      new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(d) + ' AEST'
    );
  } catch {
    return date ? String(date) : '--:--';
  }
}

function getRelativeAge(from: Date | null, to: Date): string {
  if (!from) return 'pending';
  const diffSec = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    const remSec = diffSec % 60;
    return `${diffMin}m ${remSec}s ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ${diffMin % 60}m ago`;
}

  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  const [menuInspectionTime, setMenuInspectionTime] = useState<Date>(new Date());

  useEffect(() => {
    if (menuOpen) {
      setMenuInspectionTime(new Date());
      const ticker = setInterval(() => {
        setMenuInspectionTime(new Date());
      }, 1000);
      return () => clearInterval(ticker);
    }
  }, [menuOpen]);

  const handleLockClick = async () => {
    if (adultMode) {
      await apiPost('adult_logout');
      setAdultMode(false);
      showToast('Switched to Child Mode 🔒', { type: 'info' });
    } else {
      openAdultPinModal(() => {
        showToast('Parent Mode Unlocked 🛡️', { type: 'success' });
      });
    }
  };

  const visibleAlerts = notifs.alerts.filter((a) => adultMode || !a.admin_only);
  const notifWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notifWrapRef.current && !notifWrapRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notifOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="dashboard-header-sticky">
      <div
        className="header-content"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem 1rem',
          background: isThemed
            ? `linear-gradient(135deg, ${seasonAccent}24 0%, var(--cr-header-bg-2) 100%)`
            : 'linear-gradient(135deg, var(--cr-header-bg-1) 0%, var(--cr-header-bg-2) 100%)',
          padding: '0.4rem 1.1rem',
          borderRadius: 0,
          borderBottom: isThemed
            ? `1px solid ${seasonAccent}55`
            : '1px solid var(--cr-surface-border)',
          boxShadow: isThemed ? `0 2px 14px ${seasonAccent}1a` : undefined,
          transition: 'padding 0.2s ease, background 0.3s ease, border-color 0.3s ease',
        }}
      >
        {/* Left Zone: Hamburger (Mobile) & Mascot & Title */}
        <div
          className="header-zone-left"
          style={{ display: 'flex', alignItems: 'center', flex: '1 1 auto', minWidth: 0 }}
        >
          <button
            type="button"
            className="header-mobile-hamburger"
            onClick={(e) => {
              e.stopPropagation();
              dispatch(toggleMobileDrawer());
            }}
            aria-label="Open Navigation Menu"
            title="Open Menu"
          >
            <i className="fas fa-bars" />
          </button>
          <div
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minWidth: 0 }}
            onClick={() => setActiveView('dashboard')}
          >
            <img
              src="./static/images/mascot-transp.png"
              alt="Chores Reward Icon"
              style={{
                height: headerMinimized ? 36 : 48,
                width: headerMinimized ? 36 : 48,
                marginRight: 8,
                transition: 'height 0.2s, width 0.2s',
                flexShrink: 0,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
              <h2
                className="header-app-title"
                style={{
                  color: 'var(--cr-text-primary)',
                  margin: 0,
                  fontSize: headerMinimized ? '1.05rem' : '1.22rem',
                  textTransform: 'none',
                  letterSpacing: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Chores &amp; Rewards
              </h2>
            {data?.app_version && (
              <span
                className="header-app-version"
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--cr-text-secondary)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                v{data.app_version}
              </span>
            )}
            {seasonInfo.enabled && seasonInfo.theme && (
              <span
                className="header-seasonal-badge"
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: seasonInfo.accent || '#f8fafc',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid ${seasonInfo.accent ? seasonInfo.accent + '55' : 'rgba(255, 255, 255, 0.15)'}`,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title={seasonInfo.event ? `Active Event: ${seasonInfo.theme.name}` : `Active Season: ${seasonInfo.theme.name}`}
              >
                <span>{seasonInfo.emoji}</span>
                <span className="header-seasonal-name">{seasonInfo.theme.name}</span>
              </span>
            )}
          </div>
          </div>
        </div>

        {/* Center Zone: Clock & Weather Widgets */}
        {!headerMinimized && (
          <div
            className="header-zone-center"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1.25rem',
              flex: '2 1 auto',
            }}
          >
            <ClockWidget timezone={data?.timezone} headerMinimized={headerMinimized} />
            <WeatherWidget timezone={data?.timezone} isThemed={isThemed} seasonAccent={seasonAccent} />
          </div>
        )}

        {/* Right Zone: Actions (Inline > 1400px, Burger Menu <= 1400px) */}
        {!headerMinimized && (
          <nav
            className="header-nav-actions header-zone-right"
            style={{
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              flexWrap: 'nowrap',
              minWidth: 0,
            }}
          >
            {/* Refresh Button */}
            <button
              type="button"
              id="header-refresh-btn"
              onClick={() => window.location.reload()}
              title="Full page refresh"
              className="header-action-btn header-action-inline-collapse"
            >
              <i className="fas fa-arrows-rotate" />
              <span className="header-btn-text-collapse">Refresh</span>
            </button>

            {/* Notification Bell */}
            <div className="header-notif-wrap header-action-inline-collapse" id="header-notif-wrap" ref={notifWrapRef}>
              <button
                type="button"
                className="header-notif-btn"
                id="header-notif-btn"
                onClick={() => setNotifOpen((p) => !p)}
                title="Notifications"
                aria-haspopup="true"
                aria-expanded={notifOpen}
              >
                <i className="fas fa-bell" />
                {visibleAlerts.length > 0 && (
                  <span className="header-notif-badge" id="header-notif-badge">
                    {visibleAlerts.length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="header-notif-panel" id="header-notif-panel">
                  <div className="header-notif-head">
                    <span>Notifications</span>
                    <span className="header-notif-head-meta">{visibleAlerts.length} alerts</span>
                  </div>
                  <div className="header-notif-body">
                    {visibleAlerts.map((a, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setNotifOpen(false);
                          if (a.target) scrollToSection(a.target);
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 10,
                          background:
                            a.severity === 'overdue' ? 'rgba(239, 68, 68, 0.16)' : 'rgba(245, 158, 11, 0.16)',
                          border: `1px solid ${a.severity === 'overdue' ? '#ef4444' : '#f59e0b'}`,
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{a.title}</div>
                        <div style={{ opacity: 0.8 }}>{a.detail}</div>
                      </div>
                    ))}
                    {notifs.recent.slice(0, 6).map((r) => (
                      <div
                        key={r.id}
                        style={{
                          padding: '6px 8px',
                          borderBottom: '1px solid var(--cr-surface-border)',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div>{r.description}</div>
                        <div style={{ opacity: 0.6, fontSize: '0.75rem' }}>{r.date_label}</div>
                      </div>
                    ))}
                    {visibleAlerts.length === 0 && notifs.recent.length === 0 && (
                      <p className="header-notif-empty">No notifications</p>
                    )}
                  </div>
                  <a
                    href="#activity"
                    className="header-notif-footer"
                    onClick={(e) => {
                      e.preventDefault();
                      setNotifOpen(false);
                      setActiveView('activity_log');
                    }}
                  >
                    View activity log <i className="fas fa-chevron-right" />
                  </a>
                </div>
              )}
            </div>

            {/* User Profile Switcher */}
            <button
              id="user-profile-btn"
              type="button"
              className="header-action-inline-collapse"
              onClick={() => setProfileSwitcherOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px 4px 6px',
                borderRadius: '24px',
                background: isParent
                  ? 'rgba(245, 158, 11, 0.15)'
                  : isChild
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
                border: isParent
                  ? '1px solid rgba(245, 158, 11, 0.4)'
                  : isChild
                    ? '1px solid rgba(16, 185, 129, 0.4)'
                    : '1px solid rgba(59, 130, 246, 0.4)',
                cursor: 'pointer',
                color: '#fff',
                transition: 'all 0.15s ease',
              }}
              title="Switch user profile"
            >
              {activeUser?.role === 'family' || activeUser?.name?.toLowerCase() === 'family' ? (
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.95rem',
                  }}
                >
                  👨‍👩‍👧‍👦
                </div>
              ) : activeUser?.avatar && activeUser.avatar !== 'default_avatar.png' ? (
                <img
                  src={resolveAvatarUrl(activeUser.avatar)}
                  alt={activeUser.name}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                  }}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: `2px solid ${activeUser.color || '#3b82f6'}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: activeUser?.color || '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  {activeUser ? activeUser.name.slice(0, 2) : '👤'}
                </div>
              )}

              <div className="user-profile-label" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                  {activeUser?.name || 'Family'}
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: isParent ? '#f59e0b' : isChild ? '#34d399' : '#60a5fa',
                    textTransform: 'uppercase',
                  }}
                >
                  {isParent ? 'Parent 🛡️' : isChild ? 'Child ⭐' : 'Family 👨‍👩‍👧‍👦'}
                </span>
              </div>

              <i className="fas fa-chevron-down user-profile-chevron" style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '2px' }} />
            </button>

            {/* Quick Actions Burger Menu */}
            <div className="header-menu-btn-wrap" style={{ position: 'relative' }} ref={menuWrapRef}>
              <button
                type="button"
                id="header-menu-btn"
                className={`header-menu-btn ${menuOpen ? 'is-open' : ''}`}
                onClick={() => setMenuOpen((p) => !p)}
                title="Quick Menu & Actions"
                aria-label="Quick Menu"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <i className="fas fa-bars" />
              </button>

              {menuOpen && (
                <div className="header-menu-panel" id="header-menu-panel">
                  <button
                    type="button"
                    className="header-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      setProfileSwitcherOpen(true);
                    }}
                  >
                    <i className="fas fa-users header-menu-item-icon" />
                    <span>Switch Profile ({activeUser?.name || 'Family'})</span>
                  </button>

                  <button
                    type="button"
                    className="header-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      setNotifOpen(true);
                    }}
                  >
                    <i className="fas fa-bell header-menu-item-icon" />
                    <span>Notifications {visibleAlerts.length > 0 ? `(${visibleAlerts.length})` : ''}</span>
                  </button>

                  <button
                    type="button"
                    className="header-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      window.location.reload();
                    }}
                  >
                    <i className="fas fa-arrows-rotate header-menu-item-icon" />
                    <span>Refresh App</span>
                  </button>

                  <div className="header-menu-divider" />



                  <button
                    type="button"
                    className="header-menu-item"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
                    onClick={() => {
                      setMenuOpen(false);
                      toggleMute();
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <i className={`fas ${muted ? 'fa-volume-xmark' : 'fa-volume-high'} header-menu-item-icon`} style={{ color: muted ? '#ef4444' : '#10b981' }} />
                      <span>Sound</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: muted ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                        color: muted ? '#f87171' : '#4ade80',
                        border: `1px solid ${muted ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                      }}
                    >
                      {muted ? 'MUTED ✕' : 'ON ✓'}
                    </span>
                  </button>

                  <div className="header-menu-divider" />

                  <button
                    type="button"
                    className="header-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      setVisualTimerOpen(true);
                    }}
                  >
                    <i className="fas fa-stopwatch header-menu-item-icon" />
                    <span>Visual Timer</span>
                  </button>

                  <button
                    type="button"
                    className="header-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      setScreensaverOpen(true);
                    }}
                  >
                    <i className="fas fa-tv header-menu-item-icon" />
                    <span>Screensaver</span>
                  </button>

                  <button
                    type="button"
                    className="header-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      setActiveView('activity_log');
                    }}
                  >
                    <i className="fas fa-list-check header-menu-item-icon" />
                    <span>Activity Log</span>
                  </button>

                  {adultMode && (
                    <button
                      type="button"
                      className="header-menu-item"
                      onClick={() => {
                        setMenuOpen(false);
                        setActiveView('settings');
                      }}
                    >
                      <i className="fas fa-gear header-menu-item-icon" />
                      <span>Settings & Config</span>
                    </button>
                  )}

                  <div className="header-menu-divider" style={{ margin: '6px 0 0' }} />

                  {/* Diagnostic Data Freshness Footer (AEST) */}
                  <div
                    style={{
                      padding: '8px 14px 10px',
                      background: 'rgba(0, 0, 0, 0.28)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      lineHeight: 1.35,
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--cr-text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.64rem' }}>
                        Data Freshness
                      </span>
                      <span
                        style={{
                          fontSize: '0.69rem',
                          fontWeight: 700,
                          color: lastFetchedAt && (menuInspectionTime.getTime() - lastFetchedAt.getTime() > 120000) ? '#f59e0b' : '#34d399',
                        }}
                      >
                        ● {getRelativeAge(lastFetchedAt, menuInspectionTime)}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="fas fa-database" style={{ fontSize: '0.65rem', opacity: 0.6 }} />
                      <span style={{ opacity: 0.75 }}>Last synced:</span>
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{formatAestDateTime(lastFetchedAt)}</span>
                    </div>

                    <div style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.45)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="fas fa-clock" style={{ fontSize: '0.62rem', opacity: 0.5 }} />
                      <span style={{ opacity: 0.75 }}>Checked:</span>
                      <span>{formatAestDateTime(menuInspectionTime)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </nav>
        )}

      </div>
    </header>
  );
};
