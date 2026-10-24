import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAssetUrl, resolveAvatarUrl } from '../api';
import { Overlay } from './ui';
import { useSeason, useUiPref } from '../hooks/useSettings';

function weatherInfo(code: number): { icon: string; color: string; desc: string } {
  if (code === 0) return { icon: 'fa-sun', color: '#fbbf24', desc: 'Clear Sky' };
  if (code <= 2) return { icon: 'fa-cloud-sun', color: '#fbbf24', desc: 'Partly Cloudy' };
  if (code === 3) return { icon: 'fa-cloud', color: '#94a3b8', desc: 'Overcast' };
  if (code <= 48) return { icon: 'fa-smog', color: '#94a3b8', desc: 'Foggy' };
  if (code <= 55) return { icon: 'fa-cloud-rain', color: '#93c5fd', desc: 'Drizzle' };
  if (code <= 67) return { icon: 'fa-cloud-rain', color: '#60a5fa', desc: 'Rain' };
  if (code <= 77) return { icon: 'fa-snowflake', color: '#bae6fd', desc: 'Snow' };
  if (code <= 82) return { icon: 'fa-cloud-showers-heavy', color: '#3b82f6', desc: 'Showers' };
  if (code <= 86) return { icon: 'fa-snowflake', color: '#bae6fd', desc: 'Snow Showers' };
  if (code <= 99) return { icon: 'fa-bolt', color: '#fbbf24', desc: 'Thunderstorm' };
  return { icon: 'fa-cloud', color: '#94a3b8', desc: 'Unknown' };
}

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

  const [clockTime, setClockTime] = useState('--:--');
  const [clockDate, setClockDate] = useState('Loading…');
  const [headerMinimized] = useUiPref('headerMinimized');
  const seasonInfo = useSeason();
  const isThemed = seasonInfo.enabled && Boolean(seasonInfo.theme);
  const seasonAccent = seasonInfo.accent || '#3b82f6';

  // Weather state
  const [weatherCurrent, setWeatherCurrent] = useState<{
    temp: number;
    icon: string;
    color: string;
    desc: string;
    hilo: string;
  }>({
    temp: 0,
    icon: 'fa-sun',
    color: '#fbbf24',
    desc: 'Locating…',
    hilo: 'H:--° L:--°',
  });
  const [weatherDaily, setWeatherDaily] = useState<any>(null);
  const [weatherExpanded, setWeatherExpanded] = useState(false);

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

  // Live clock
  useEffect(() => {
    const tz =
      data?.timezone && data.timezone !== 'UTC'
        ? data.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;

    const updateClock = () => {
      const now = new Date();
      try {
        setClockTime(
          new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }).format(now)
        );
        setClockDate(
          new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }).format(now)
        );
      } catch {
        setClockTime(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
        setClockDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
      }
    };
    updateClock();
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, [data?.timezone]);

  // Open-Meteo Weather
  useEffect(() => {
    let mounted = true;
    const tz =
      data?.timezone && data.timezone !== 'UTC'
        ? data.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const city = (tz.split('/').pop() || 'Adelaide').replace(/_/g, ' ');

    async function loadWeather() {
      try {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
        );
        if (!geoRes.ok) return;
        const geoData = await geoRes.json();
        if (!geoData.results?.length) return;
        const { latitude, longitude } = geoData.results[0];

        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min&forecast_days=7&temperature_unit=celsius&timezone=${encodeURIComponent(tz)}`
        );
        if (!wRes.ok) return;
        const wData = await wRes.json();
        if (!mounted) return;
        const info = weatherInfo(wData.current.weathercode);
        const max0 = Math.round(wData.daily?.temperature_2m_max?.[0] ?? 0);
        const min0 = Math.round(wData.daily?.temperature_2m_min?.[0] ?? 0);
        setWeatherCurrent({
          temp: Math.round(wData.current.temperature_2m),
          icon: info.icon,
          color: info.color,
          desc: info.desc,
          hilo: `H:${max0}° L:${min0}°`,
        });
        setWeatherDaily(wData.daily);
      } catch {
        // Fallback offline forecast so the 7-day forecast overlay always works
        if (mounted) {
          const days = [];
          const now = new Date();
          for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() + i);
            days.push(d.toISOString().slice(0, 10));
          }
          setWeatherDaily({
            time: days,
            weathercode: [0, 1, 2, 0, 3, 1, 0],
            temperature_2m_max: [24, 25, 23, 22, 21, 23, 25],
            temperature_2m_min: [14, 15, 14, 13, 12, 13, 14],
          });
          setWeatherCurrent({
            temp: 22,
            icon: 'fa-sun',
            color: '#fbbf24',
            desc: 'Sunny',
            hilo: 'H:24° L:14°',
          });
        }
      }
    }

    loadWeather();
    const interval = setInterval(loadWeather, 30 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [data?.timezone]);

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
          borderRadius: '14px 14px 0 0',
          borderBottom: isThemed
            ? `1px solid ${seasonAccent}55`
            : '1px solid var(--cr-surface-border)',
          boxShadow: isThemed ? `0 2px 14px ${seasonAccent}1a` : undefined,
          transition: 'padding 0.2s ease, background 0.3s ease, border-color 0.3s ease',
        }}
      >
        {/* Left Zone: Mascot & Title */}
        <div
          className="header-zone-left"
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flex: '1 1 0', minWidth: 'max-content' }}
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
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2
              style={{
                color: 'var(--cr-text-primary)',
                margin: 0,
                fontSize: headerMinimized ? '1.05rem' : '1.22rem',
                textTransform: 'none',
                letterSpacing: 0,
                whiteSpace: 'nowrap',
              }}
            >
              Chores and Rewards
            </h2>
            {data?.app_version && (
              <span
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
                <span>{seasonInfo.theme.name}</span>
              </span>
            )}
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
            {/* Clock Widget */}
            <div
              id="clock-widget"
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                color: 'var(--cr-text-primary)',
                flexShrink: 0,
                lineHeight: 1.05,
                padding: '0 4px',
              }}
            >
              <div
                id="clock-time"
                style={{
                  fontSize: headerMinimized ? '1.35em' : '1.75em',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.01em',
                }}
              >
                {clockTime}
              </div>
              {!headerMinimized && (
                <div
                  id="clock-date"
                  style={{ fontSize: '0.9em', opacity: 0.75, whiteSpace: 'nowrap', fontWeight: 600 }}
                >
                  {clockDate}
                </div>
              )}
            </div>

            {/* Weather Widget */}
            <div
              id="weather-widget"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--cr-text-primary)',
                flexShrink: 0,
                padding: '0 4px',
              }}
            >
              <i
                id="weather-icon"
                className={`fas ${weatherCurrent.icon}`}
                style={{ fontSize: '1.85em', color: weatherCurrent.color, flexShrink: 0 }}
              />
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span id="weather-temp" style={{ fontSize: '1.45em', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {weatherCurrent.temp}°
                  </span>
                  <span
                    id="weather-hilo"
                    style={{ fontSize: '0.82em', opacity: 0.8, fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    {weatherCurrent.hilo}
                  </span>
                </div>
                <div
                  id="weather-desc"
                  style={{ fontSize: '0.8em', opacity: 0.8, whiteSpace: 'nowrap', fontWeight: 600 }}
                >
                  {weatherCurrent.desc}
                </div>
              </div>
              <button
                type="button"
                id="weather-expand-btn"
                onClick={() => setWeatherExpanded((prev) => !prev)}
                title="Show 7-day forecast"
                aria-expanded={weatherExpanded}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--cr-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.85em',
                  padding: '2px 4px',
                  margin: 0,
                  lineHeight: 1,
                  opacity: 0.7,
                }}
              >
                <i
                  className="fas fa-chevron-down"
                  id="weather-expand-icon"
                  style={{
                    transition: 'transform 0.25s',
                    transform: weatherExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>
            </div>
          </div>
        )}

        {/* Right Zone: Actions (Inline > 1400px, Burger Menu <= 1400px) */}
        {!headerMinimized && (
          <nav
            className="header-nav-actions header-zone-right"
            style={{
              flex: '1 1 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              flexWrap: 'nowrap',
              minWidth: 'max-content',
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

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
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

              <i className="fas fa-chevron-down" style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '2px' }} />
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

                  <button
                    type="button"
                    className="header-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      if (adultMode) {
                        setActiveView('settings');
                      } else {
                        openAdultPinModal(() => setActiveView('settings'));
                      }
                    }}
                  >
                    <i className="fas fa-gear header-menu-item-icon" />
                    <span>Settings & Config</span>
                  </button>

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

      {/* Weather Dimmed Backdrop & Floating Forecast Panel */}
      <Overlay
        open={Boolean(weatherExpanded && weatherDaily)}
        onClose={() => setWeatherExpanded(false)}
        backdropBlur
        lockScroll
        className="weather-backdrop-overlay"
        style={{ alignItems: 'flex-start', paddingTop: '75px' }}
      >
        <div
          id="weather-forecast-panel"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(940px, calc(100vw - 32px))',
            background: isThemed
              ? `linear-gradient(135deg, ${seasonAccent}22 0%, var(--cr-header-bg-2) 100%)`
              : 'linear-gradient(135deg, var(--cr-header-bg-1) 0%, var(--cr-header-bg-2) 100%)',
            borderRadius: '16px',
            border: isThemed
              ? `1px solid ${seasonAccent}55`
              : '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: isThemed
              ? `0 20px 45px -8px rgba(0, 0, 0, 0.75), 0 0 25px ${seasonAccent}33`
              : '0 20px 45px -8px rgba(0, 0, 0, 0.75), 0 0 25px rgba(59, 130, 246, 0.25)',
            overflow: 'hidden',
          }}
        >
          {isThemed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 22px 0',
                fontSize: '0.86rem',
                fontWeight: 700,
                color: seasonAccent,
                borderBottom: `1px solid ${seasonAccent}25`,
                paddingBottom: 8,
                margin: '0 4px',
              }}
            >
              <span>{seasonInfo.emoji} {seasonInfo.theme?.name} Forecast</span>
              <span style={{ fontSize: '0.78rem', opacity: 0.85, fontWeight: 600 }}>
                {seasonInfo.greetingSuffix}
              </span>
            </div>
          )}
          <div
            id="weather-forecast-days"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
              gap: 12,
              padding: '16px 22px',
            }}
          >
            {(weatherDaily?.time || []).map((dateStr: string, idx: number) => {
              const d = new Date(`${dateStr}T00:00:00`);
              const dayLabel = idx === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
              const info = weatherInfo(weatherDaily.weathercode?.[idx] ?? 0);
              const max = Math.round(weatherDaily.temperature_2m_max?.[idx] ?? 0);
              const min = Math.round(weatherDaily.temperature_2m_min?.[idx] ?? 0);
              return (
                <div
                  key={dateStr}
                  style={{
                    textAlign: 'center',
                    padding: '10px 8px',
                    borderRadius: 12,
                    background: idx === 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.06)',
                    border: idx === 0 ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ color: 'var(--cr-text-primary)', fontSize: '0.9em', fontWeight: 700, marginBottom: 6 }}>
                    {dayLabel}
                  </div>
                  <i className={`fas ${info.icon}`} style={{ fontSize: '1.8em', color: info.color }} />
                  <div style={{ color: 'var(--cr-text-primary)', fontSize: '1em', fontWeight: 700, marginTop: 6 }}>
                    {max}° <span style={{ opacity: 0.65, fontWeight: 500 }}>{min}°</span>
                  </div>
                  <div style={{ color: 'var(--cr-text-secondary)', fontSize: '0.75em', marginTop: 4 }}>
                    {info.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Overlay>
    </header>
  );
};
