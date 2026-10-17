import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost } from '../api';

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

  const toggleMinimizeHeader = () => {
    setHeaderMinimized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('headerMinimized', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const visibleAlerts = notifs.alerts.filter((a) => adultMode || !a.admin_only);

  return (
    <header className={`dashboard-header-sticky${headerMinimized ? ' header-minimized' : ''}`}>
      <div
        className="header-content"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          rowGap: '0.6rem',
          background: 'linear-gradient(135deg, var(--cr-header-bg-1) 0%, var(--cr-header-bg-2) 100%)',
          padding: '0.75rem 1.5rem',
          borderRadius: '14px 14px 0 0',
          borderBottom: '1px solid var(--cr-surface-border)',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setActiveView('dashboard')}
        >
          <img
            src="./static/images/mascot-transp.png"
            alt="Chores Reward Icon"
            style={{ height: 70, width: 70, marginRight: 10 }}
          />
          <h2
            style={{
              color: 'var(--cr-text-primary)',
              margin: 0,
              fontSize: '1.4rem',
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            Chores and Rewards
          </h2>
        </div>

        {/* Clock Widget */}
        <div
          id="clock-widget"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--cr-text-primary)',
            flexShrink: 0,
            lineHeight: 1.05,
            padding: '0 8px',
          }}
        >
          <div
            id="clock-time"
            style={{ fontSize: '2.6em', fontWeight: 800, whiteSpace: 'nowrap', letterSpacing: '0.01em' }}
          >
            {clockTime}
          </div>
          <div
            id="clock-date"
            style={{ fontSize: '1.05em', opacity: 0.75, whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            {clockDate}
          </div>
        </div>

        {/* Weather Widget */}
        <div
          id="weather-widget"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: 'var(--cr-text-primary)',
            flexShrink: 0,
            padding: '0 6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <i
              id="weather-icon"
              className={`fas ${weatherCurrent.icon}`}
              style={{ fontSize: '2.9em', color: weatherCurrent.color, flexShrink: 0 }}
            />
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span id="weather-temp" style={{ fontSize: '2.3em', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {weatherCurrent.temp}°
                </span>
                <span
                  id="weather-hilo"
                  style={{ fontSize: '1.05em', opacity: 0.8, fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  {weatherCurrent.hilo}
                </span>
              </div>
              <div
                id="weather-desc"
                style={{ fontSize: '1.05em', opacity: 0.8, whiteSpace: 'nowrap', fontWeight: 600 }}
              >
                {weatherCurrent.desc}
              </div>
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
              fontSize: '0.9em',
              padding: '2px 0 0',
              margin: 0,
              lineHeight: 1,
              opacity: 0.55,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.15s',
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

        {/* Header Actions */}
        <nav className="header-nav-actions">
          {/* Notification Bell */}
          <div className="header-notif-wrap" id="header-notif-wrap">
            <button
              type="button"
              className="header-notif-btn"
              id="header-notif-btn"
              onClick={() => {
                setNotifOpen((p) => !p);
                setQuickAddOpen(false);
              }}
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

          {/* Quick Add Dropdown */}
          <div
            className={`header-quick-add-wrap${quickAddOpen ? ' is-open' : ''}`}
            id="header-quick-add-wrap"
          >
            <button
              type="button"
              className="header-quick-add-btn"
              id="header-quick-add-btn"
              aria-haspopup="true"
              aria-expanded={quickAddOpen}
              title="Quick Add"
              onClick={() => {
                setQuickAddOpen((p) => !p);
                setNotifOpen(false);
              }}
            >
              <i className="fas fa-plus" />
              <span>Quick Add</span>
              <i className="fas fa-chevron-down quick-add-chevron" />
            </button>
            <div className="header-quick-add-menu" id="header-quick-add-menu">
              <button
                type="button"
                className="header-quick-add-item"
                onClick={() => {
                  setQuickAddOpen(false);
                  if (!adultMode) {
                    openAdultPinModal(() => scrollToSection('add-chores-section'));
                  } else {
                    scrollToSection('add-chores-section');
                  }
                }}
              >
                <i className="fas fa-tasks" style={{ color: '#e100ff' }} />
                <span>Add Chore</span>
              </button>
              <button
                type="button"
                className="header-quick-add-item"
                onClick={() => {
                  setQuickAddOpen(false);
                  scrollToSection('shopping-list-section');
                }}
              >
                <i className="fas fa-cart-shopping" style={{ color: '#10b981' }} />
                <span>Add Shopping</span>
              </button>
              <button
                type="button"
                className="header-quick-add-item"
                onClick={() => {
                  setQuickAddOpen(false);
                  scrollToSection('notes-kanban-section');
                }}
              >
                <i className="fas fa-sticky-note" style={{ color: '#fbbf24' }} />
                <span>New Note</span>
              </button>
              <button
                type="button"
                className="header-quick-add-item admin-only"
                onClick={() => {
                  setQuickAddOpen(false);
                  if (!adultMode) {
                    openAdultPinModal(() => scrollToSection('organise-section'));
                  } else {
                    scrollToSection('organise-section');
                  }
                }}
              >
                <i className="fas fa-folder-open" style={{ color: '#38bdf8' }} />
                <span>Add Organise</span>
              </button>
              <button
                type="button"
                className="header-quick-add-item admin-only"
                onClick={() => {
                  setQuickAddOpen(false);
                  if (!adultMode) {
                    openAdultPinModal(() => scrollToSection('create-reward-section'));
                  } else {
                    scrollToSection('create-reward-section');
                  }
                }}
              >
                <i className="fas fa-gift" style={{ color: '#a78bfa' }} />
                <span>Create Reward</span>
              </button>
            </div>
          </div>

          <a
            href="#activity_log"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('activity_log');
            }}
          >
            <i className="fas fa-history" /> Activity Log
          </a>

          <a
            href="#settings"
            className="admin-only flex-admin-only"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('settings');
            }}
          >
            <i className="fas fa-cog" /> Settings
          </a>

          <button id="theme-toggle-btn" onClick={toggleTheme} title="Toggle light/dark mode">
            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
          </button>

          <button
            id="adult-lock-btn"
            className={adultMode ? 'unlocked' : 'locked'}
            onClick={handleLockClick}
            title={adultMode ? 'Adult mode unlocked — tap to lock' : 'Tap to unlock adult mode'}
          >
            <i className={`fas ${adultMode ? 'fa-lock-open' : 'fa-lock'}`} />
          </button>
        </nav>

        <button
          className="mute-toggle"
          id="mute-toggle"
          onClick={toggleMute}
          title={muted ? 'Unmute All Sounds' : 'Mute All Sounds'}
          style={{
            background: 'var(--cr-header-control-bg)',
            border: 'none',
            color: muted ? '#ef4444' : 'var(--cr-text-primary)',
            padding: 10,
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '1.2em',
          }}
        >
          <i className={`fas ${muted ? 'fa-volume-mute' : 'fa-volume-up'}`} id="mute-icon" />
        </button>

        <button
          id="header-collapse-toggle"
          title={headerMinimized ? 'Expand header' : 'Minimize header'}
          onClick={toggleMinimizeHeader}
        >
          <i className={`fas ${headerMinimized ? 'fa-chevron-down' : 'fa-chevron-up'}`} />
        </button>
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
