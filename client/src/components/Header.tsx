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

  return (
    <header className="dashboard-header-sticky">
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
            onClick={() => setWeatherExpanded((prev) => !prev)}
            title="Show 7-day forecast"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--cr-text-secondary)',
              cursor: 'pointer',
              fontSize: '0.9em',
              padding: '2px 0 0',
              margin: 0,
              lineHeight: 1,
              opacity: 0.7,
            }}
          >
            <i
              className="fas fa-chevron-down"
              style={{
                transition: 'transform 0.25s',
                transform: weatherExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>
        </div>

        {/* Header Actions */}
        <nav className="header-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Notification Bell */}
          <div className="header-notif-wrap" style={{ position: 'relative' }}>
            <button
              type="button"
              className="header-notif-btn"
              onClick={() => {
                setNotifOpen((p) => !p);
                setQuickAddOpen(false);
              }}
              title="Notifications"
            >
              <i className="fas fa-bell" />
              {visibleAlerts.length > 0 && (
                <span className="header-notif-badge">{visibleAlerts.length}</span>
              )}
            </button>
            {notifOpen && (
              <div
                className="header-notif-panel"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: 340,
                  zIndex: 9999,
                  background: 'var(--cr-surface-1)',
                  border: '1px solid var(--cr-surface-border)',
                  borderRadius: 14,
                  boxShadow: '0 16px 36px rgba(0,0,0,0.45)',
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  <span>Notifications</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{visibleAlerts.length} alerts</span>
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                    <p style={{ opacity: 0.7, textAlign: 'center', margin: '12px 0' }}>No notifications</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    setActiveView('activity_log');
                  }}
                  style={{
                    marginTop: 10,
                    width: '100%',
                    padding: '8px',
                    borderRadius: 8,
                    background: 'var(--cr-surface-2)',
                    color: 'var(--cr-text-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  View activity log <i className="fas fa-chevron-right" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Add Dropdown */}
          <div className={`header-quick-add-wrap ${quickAddOpen ? 'is-open' : ''}`} style={{ position: 'relative' }}>
            <button
              type="button"
              className="header-quick-add-btn"
              onClick={() => {
                setQuickAddOpen((p) => !p);
                setNotifOpen(false);
              }}
            >
              <i className="fas fa-plus" />
              <span>Quick Add</span>
              <i className="fas fa-chevron-down quick-add-chevron" />
            </button>
            {quickAddOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  background: 'var(--cr-surface-1)',
                  border: '1px solid var(--cr-surface-border)',
                  borderRadius: 12,
                  padding: 8,
                  minWidth: 190,
                  zIndex: 9999,
                  boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
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
                  <i className="fas fa-shopping-basket" style={{ color: '#38bdf8' }} />
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
                  <i className="fas fa-sticky-note" style={{ color: '#fde047' }} />
                  <span>New Note</span>
                </button>
                <button
                  type="button"
                  className="header-quick-add-item"
                  onClick={() => {
                    setQuickAddOpen(false);
                    if (!adultMode) {
                      openAdultPinModal(() => scrollToSection('organise-section'));
                    } else {
                      scrollToSection('organise-section');
                    }
                  }}
                >
                  <i className="fas fa-folder-open" style={{ color: '#f59e0b' }} />
                  <span>Add Organise</span>
                </button>
                <button
                  type="button"
                  className="header-quick-add-item"
                  onClick={() => {
                    setQuickAddOpen(false);
                    if (!adultMode) {
                      openAdultPinModal(() => scrollToSection('create-reward-section'));
                    } else {
                      scrollToSection('create-reward-section');
                    }
                  }}
                >
                  <i className="fas fa-gift" style={{ color: '#a855f7' }} />
                  <span>Create Reward</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setActiveView('activity_log')}
            className="header-action-btn"
            title="Activity Log"
            style={{
              background: 'var(--cr-surface-2)',
              color: 'var(--cr-text-primary)',
              border: '1px solid var(--cr-surface-border)',
              borderRadius: 10,
              padding: '8px 12px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <i className="fas fa-chart-line" />
            <span className="hidden md:inline">Activity</span>
          </button>

          {adultMode && (
            <button
              type="button"
              onClick={() => setActiveView('settings')}
              className="header-action-btn"
              title="Settings"
              style={{
                background: 'var(--cr-surface-2)',
                color: 'var(--cr-text-primary)',
                border: '1px solid var(--cr-surface-border)',
                borderRadius: 10,
                padding: '8px 12px',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="fas fa-cog" />
              <span className="hidden md:inline">Settings</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            type="button"
            id="theme-toggle-btn"
            onClick={toggleTheme}
            title="Toggle dark/light theme"
            style={{
              background: 'var(--cr-surface-2)',
              color: 'var(--cr-text-primary)',
              border: '1px solid var(--cr-surface-border)',
              borderRadius: 10,
              width: 40,
              height: 40,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
          </button>

          {/* Mute Toggle */}
          <button
            type="button"
            id="mute-toggle"
            onClick={toggleMute}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
            style={{
              background: 'var(--cr-surface-2)',
              color: muted ? '#ef4444' : 'var(--cr-text-primary)',
              border: '1px solid var(--cr-surface-border)',
              borderRadius: 10,
              width: 40,
              height: 40,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i className={`fas ${muted ? 'fa-volume-mute' : 'fa-volume-up'}`} />
          </button>

          {/* Adult Lock Button */}
          <button
            type="button"
            id="adult-lock-btn"
            onClick={handleLockClick}
            title={adultMode ? 'Adult Mode Unlocked (Click to lock)' : 'Child Mode (Click to unlock Adult Mode)'}
            style={{
              background: adultMode ? 'rgba(34, 197, 94, 0.2)' : 'var(--cr-surface-2)',
              color: adultMode ? '#4ade80' : 'var(--cr-text-primary)',
              border: `1px solid ${adultMode ? '#22c55e' : 'var(--cr-surface-border)'}`,
              borderRadius: 10,
              padding: '8px 12px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <i className={`fas ${adultMode ? 'fa-lock-open' : 'fa-lock'}`} />
            <span className="hidden sm:inline">{adultMode ? 'Adult' : 'Locked'}</span>
          </button>
        </nav>
      </div>

      {/* 7-Day Weather Forecast Panel */}
      {weatherExpanded && weatherDaily && (
        <div
          id="weather-forecast-panel"
          style={{
            background: 'var(--cr-surface-1)',
            borderBottom: '1px solid var(--cr-surface-border)',
            padding: '14px 20px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))',
              gap: 12,
            }}
          >
            {(weatherDaily.time || []).map((dateStr: string, idx: number) => {
              const d = new Date(`${dateStr}T00:00:00`);
              const dayLabel = idx === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
              const info = weatherInfo(weatherDaily.weathercode?.[idx] ?? 0);
              const max = Math.round(weatherDaily.temperature_2m_max?.[idx] ?? 0);
              const min = Math.round(weatherDaily.temperature_2m_min?.[idx] ?? 0);
              return (
                <div key={dateStr} style={{ textAlign: 'center', padding: 8, borderRadius: 10, background: 'var(--cr-surface-2)' }}>
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
      )}
    </header>
  );
};
