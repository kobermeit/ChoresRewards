import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAssetUrl, resolveAvatarUrl } from '../api';

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
  } = useApp();

  const [clockTime, setClockTime] = useState('--:--');
  const [clockDate, setClockDate] = useState('Loading…');
  const [headerMinimized, setHeaderMinimized] = useState(() => {
    try {
      return localStorage.getItem('headerMinimized') === '1';
    } catch {
      return false;
    }
  });

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
        // ignore offline weather errors
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

  const handleLockClick = async () => {
    if (adultMode) {
      await apiPost('adult_logout');
      setAdultMode(false);
      showToast('Switched to Child Mode 🔒', { type: 'info' });
    } else {
      openAdultPinModal();
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

  return (
    <header className="dashboard-header-sticky">
      <div
        className="header-content"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.4rem 0.8rem',
          background: 'linear-gradient(135deg, var(--cr-header-bg-1) 0%, var(--cr-header-bg-2) 100%)',
          padding: '0.4rem 1.1rem',
          borderRadius: '14px 14px 0 0',
          borderBottom: '1px solid var(--cr-surface-border)',
          transition: 'padding 0.2s ease',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
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
          </div>
        </div>

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
        {!headerMinimized && (
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
        )}

        {/* Header Actions: Notification Bell + Adult Lock */}
        {!headerMinimized && (
          <nav
            className="header-nav-actions"
            style={{
              width: 'auto',
              marginLeft: 'auto',
              paddingTop: 0,
              borderTop: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'nowrap',
            }}
          >
            {/* Refresh Button */}
            <button
              type="button"
              id="header-refresh-btn"
              onClick={() => window.location.reload()}
              title="Full page refresh"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--cr-surface-border)',
                color: 'var(--cr-text-primary)',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              <i className="fas fa-arrows-rotate" />
              <span>Refresh</span>
            </button>

            {/* Notification Bell */}
            <div className="header-notif-wrap" id="header-notif-wrap" ref={notifWrapRef}>
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
          </nav>
        )}

      </div>

      {/* 7-Day Weather Forecast Panel */}
      <div
        id="weather-forecast-panel"
        style={{
          maxHeight: weatherExpanded && weatherDaily ? 300 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s ease',
          background: 'linear-gradient(135deg, var(--cr-header-bg-1) 0%, var(--cr-header-bg-2) 100%)',
          borderRadius: '0 0 14px 14px',
          marginBottom: '1.2rem',
        }}
      >
        {weatherDaily && (
          <div
            id="weather-forecast-days"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
              gap: 12,
              padding: '16px 22px',
            }}
          >
            {(weatherDaily.time || []).map((dateStr: string, idx: number) => {
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
                    padding: 8,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)',
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
        )}
      </div>
    </header>
  );
};
