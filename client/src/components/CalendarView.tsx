import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CalendarEvent } from '../types';
import { apiPost } from '../api';
import { Modal } from './common/Modal';

export const CalendarView: React.FC = () => {
  const { data, refresh, showToast, isParent } = useApp();
  const [viewMode, setViewMode] = useState<'month' | 'agenda' | 'embed'>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Settings form state
  const gcal = data?.google_calendar;
  const [icalUrlInput, setIcalUrlInput] = useState(gcal?.ical_url || '');
  const [embedUrlInput, setEmbedUrlInput] = useState(gcal?.embed_url || '');
  const [savingSettings, setSavingSettings] = useState(false);

  // Calendar month navigation state
  const todayDate = new Date();
  const [currentYear, setCurrentYear] = useState(todayDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(todayDate.getMonth()); // 0-indexed

  if (!data) return null;

  const events: CalendarEvent[] = gcal?.events || [];
  const localToday = data.current_date; // YYYY-MM-DD

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiPost<{ success: boolean; error?: string; events?: CalendarEvent[] }>('sync_calendar', {});
      if (res?.error) {
        showToast(res.error, { type: 'error' });
      } else {
        showToast('Calendar synced with Google!', { type: 'success' });
        await refresh();
      }
    } catch (err: any) {
      showToast(err?.message || 'Sync failed', { type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiPost('save_calendar_settings', {
        gcal_ical_url: icalUrlInput.trim(),
        gcal_embed_url: embedUrlInput.trim(),
        google_calendar_enabled: true,
      });
      showToast('Calendar settings saved and synced!', { type: 'success' });
      setSettingsOpen(false);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save settings', { type: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  // Month navigation
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Build grid for month view
  // First day of month (0 = Sun, 1 = Mon, etc.)
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  // Monday-first offset (0 for Mon, 6 for Sun)
  const mondayOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Create 42 grid cells (6 rows x 7 cols)
  const calendarCells: Array<{
    dateIso: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    events: CalendarEvent[];
  }> = [];

  // Previous month trailing days
  for (let i = mondayOffset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const mStr = String(prevMonthIdx + 1).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    const dateIso = `${prevYear}-${mStr}-${dStr}`;
    calendarCells.push({
      dateIso,
      dayNum,
      isCurrentMonth: false,
      isToday: dateIso === localToday,
      events: events.filter((e) => e.start_date_iso === dateIso),
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(currentMonth + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    const dateIso = `${currentYear}-${mStr}-${dStr}`;
    calendarCells.push({
      dateIso,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateIso === localToday,
      events: events.filter((e) => e.start_date_iso === dateIso),
    });
  }

  // Next month leading days to complete grid (up to 35 or 42 cells)
  const totalCellsNeeded = calendarCells.length > 35 ? 42 : 35;
  const remaining = totalCellsNeeded - calendarCells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonthIdx = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const mStr = String(nextMonthIdx + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    const dateIso = `${nextYear}-${mStr}-${dStr}`;
    calendarCells.push({
      dateIso,
      dayNum: d,
      isCurrentMonth: false,
      isToday: dateIso === localToday,
      events: events.filter((e) => e.start_date_iso === dateIso),
    });
  }

  // Agenda view: group upcoming events from today onwards
  const agendaEvents = [...events]
    .filter((e) => e.start_date_iso >= localToday)
    .sort((a, b) => {
      if (a.start_date_iso !== b.start_date_iso) return a.start_date_iso.localeCompare(b.start_date_iso);
      if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
      return (a.start_time_sort || '00:00').localeCompare(b.start_time_sort || '00:00');
    });

  // Group agenda events by date
  const agendaGroups: Record<string, CalendarEvent[]> = {};
  for (const ev of agendaEvents) {
    if (!agendaGroups[ev.start_date_iso]) agendaGroups[ev.start_date_iso] = [];
    agendaGroups[ev.start_date_iso].push(ev);
  }

  const hasConfig = Boolean(gcal?.ical_url || gcal?.embed_url);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 20px 64px' }}>
      {/* Top Header & Navigation Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(12px)',
          padding: '16px 20px',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.25)',
            }}
          >
            📅
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
              Family Calendar
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
              Synced with Google Calendar
              {gcal?.last_sync && ` • Last synced ${new Date(gcal.last_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>

        {/* View Switcher & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(0,0,0,0.25)',
              padding: 4,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('month')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: viewMode === 'month' ? '#0284c7' : 'transparent',
                color: viewMode === 'month' ? '#ffffff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              <i className="fas fa-calendar-days" /> Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: viewMode === 'agenda' ? '#0284c7' : 'transparent',
                color: viewMode === 'agenda' ? '#ffffff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              <i className="fas fa-list-ul" /> Agenda
            </button>
            <button
              type="button"
              onClick={() => setViewMode('embed')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: viewMode === 'embed' ? '#0284c7' : 'transparent',
                color: viewMode === 'embed' ? '#ffffff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              <i className="fas fa-globe" /> Embed View
            </button>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.06)',
              color: '#f8fafc',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: syncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Refresh events from Google"
          >
            <i className={`fas fa-rotate ${syncing ? 'fa-spin' : ''}`} style={{ color: '#38bdf8' }} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: settingsOpen ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.06)',
              color: settingsOpen ? '#38bdf8' : '#f8fafc',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <i className="fas fa-gear" /> {settingsOpen ? 'Close Settings' : 'Calendar Setup'}
          </button>
        </div>
      </div>

      {/* Setup & Connection Banner (if not connected or settings toggled open) */}
      {(settingsOpen || !hasConfig) && (
        <div
          style={{
            marginBottom: 24,
            padding: 22,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12), rgba(30, 41, 59, 0.7))',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>
                🔗 Connect Your Google Calendar
              </h3>
              <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                Sync your family events directly without needing any Google Cloud developer accounts or API keys:
              </p>
              <ol style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.6 }}>
                <li>Open <strong>Google Calendar</strong> on your desktop.</li>
                <li>In the left sidebar under "My calendars", hover over your Family calendar and click <strong>⋮ &rarr; Settings and sharing</strong>.</li>
                <li>Scroll down to <strong>"Integrate calendar"</strong> and copy the <strong>"Secret address in iCal format"</strong> (ends with <code>.ics</code>).</li>
                <li>(Optional) You can also copy the <strong>"Embed code"</strong> link for the full interactive Google Calendar iframe.</li>
              </ol>
            </div>
            {hasConfig && (
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            )}
          </div>

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                Secret address in iCal format (.ics URL):
              </label>
              <input
                type="url"
                value={icalUrlInput}
                onChange={(e) => setIcalUrlInput(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/.../private-.../basic.ics"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(15, 23, 42, 0.7)',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                Google Calendar Embed URL (Optional for iframe view):
              </label>
              <input
                type="url"
                value={embedUrlInput}
                onChange={(e) => setEmbedUrlInput(e.target.value)}
                placeholder="https://calendar.google.com/calendar/embed?src=..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(15, 23, 42, 0.7)',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="submit"
                disabled={savingSettings}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: savingSettings ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <i className="fas fa-check" />
                {savingSettings ? 'Saving...' : 'Save & Sync Calendar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Month Navigation Row (For Month View) */}
      {viewMode === 'month' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc' }}>
              {monthNames[currentMonth]} {currentYear}
            </h2>
            <button
              type="button"
              onClick={goToday}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)',
                color: '#38bdf8',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Today
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={prevMonth}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Previous Month"
            >
              <i className="fas fa-chevron-left" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Next Month"
            >
              <i className="fas fa-chevron-right" />
            </button>
          </div>
        </div>
      )}

      {/* 1. MONTH VIEW */}
      {viewMode === 'month' && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(14px)',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Day of Week Headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              background: 'rgba(255, 255, 255, 0.03)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '0.82rem',
              color: '#94a3b8',
              letterSpacing: '0.5px',
            }}
          >
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
              <div key={day} style={{ padding: '12px 6px' }}>
                {day}
              </div>
            ))}
          </div>

          {/* Grid Cells */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridAutoRows: 'minmax(115px, auto)',
              gap: '1px',
              background: 'rgba(255, 255, 255, 0.06)',
            }}
          >
            {calendarCells.map((cell, idx) => (
              <div
                key={idx}
                className="calendar-day-cell"
                style={{
                  background: cell.isToday
                    ? 'rgba(2, 132, 199, 0.12)'
                    : cell.isCurrentMonth
                    ? 'rgba(15, 23, 42, 0.9)'
                    : 'rgba(10, 15, 30, 0.6)',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  minHeight: 110,
                  position: 'relative',
                  transition: 'background 0.15s',
                }}
              >
                {/* Date Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      fontWeight: cell.isToday ? 800 : 600,
                      color: cell.isToday
                        ? '#ffffff'
                        : cell.isCurrentMonth
                        ? '#e2e8f0'
                        : '#64748b',
                      background: cell.isToday ? '#0284c7' : 'transparent',
                    }}
                  >
                    {cell.dayNum}
                  </span>
                  {cell.events.length > 0 && (
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                      {cell.events.length} {cell.events.length === 1 ? 'event' : 'events'}
                    </span>
                  )}
                </div>

                {/* Event Chips */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', maxHeight: 110 }}>
                  {cell.events.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      style={{
                        padding: '3px 6px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderLeft: `3px solid ${ev.color || '#38bdf8'}`,
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        color: '#f8fafc',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'transform 0.1s, background 0.1s',
                      }}
                      title={`${ev.time_display ? ev.time_display + ': ' : ''}${ev.title}`}
                    >
                      <span>{ev.emoji || '📅'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.title}
                      </span>
                    </div>
                  ))}
                  {cell.events.length > 3 && (
                    <div
                      onClick={() => setSelectedEvent(cell.events[3])}
                      style={{
                        fontSize: '0.68rem',
                        color: '#38bdf8',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '1px 4px',
                      }}
                    >
                      +{cell.events.length - 3} more...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. AGENDA / LIST VIEW */}
      {viewMode === 'agenda' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.keys(agendaGroups).length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 16,
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🌴</div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>No upcoming events scheduled</h3>
              <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                Enjoy your free time, or tap "Sync Now" if you recently added events to Google Calendar.
              </p>
            </div>
          ) : (
            Object.entries(agendaGroups).map(([dateIso, dayEvents]) => {
              const isToday = dateIso === localToday;
              const dateObj = new Date(`${dateIso}T00:00:00`);
              const dayFormatted = dateObj.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={dateIso}
                  style={{
                    background: isToday ? 'rgba(2, 132, 199, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 14,
                    border: isToday
                      ? '1px solid rgba(56, 189, 248, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.06)',
                    padding: '16px 20px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                      paddingBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: isToday ? '#38bdf8' : '#f8fafc',
                        }}
                      >
                        {dayFormatted}
                      </span>
                      {isToday && (
                        <span
                          style={{
                            background: '#0284c7',
                            color: '#ffffff',
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          TODAY
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                      {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 14,
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          borderRadius: 10,
                          borderLeft: `4px solid ${ev.color || '#38bdf8'}`,
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '1.3rem' }}>{ev.emoji || '📅'}</span>
                          <div>
                            <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#f8fafc' }}>
                              {ev.title}
                            </div>
                            {ev.location && (
                              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>
                                📍 {ev.location}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: ev.all_day ? '#4ade80' : '#38bdf8',
                              background: 'rgba(0,0,0,0.25)',
                              padding: '4px 10px',
                              borderRadius: 6,
                            }}
                          >
                            {ev.time_display || 'All Day'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. GOOGLE CALENDAR EMBED VIEW */}
      {viewMode === 'embed' && (
        gcal?.embed_url ? (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: 16,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <iframe
              src={gcal.embed_url}
              title="Google Calendar"
              style={{
                width: '100%',
                height: '780px',
                border: 'none',
                borderRadius: 16,
              }}
            />
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: 16,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '64px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: 'rgba(2, 132, 199, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
              }}
            >
              <i className="fas fa-globe" />
            </div>
            <div style={{ maxWidth: 480 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
                No Google Calendar Embed URL Configured
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.5, margin: 0 }}>
                You must provide a Google Calendar Embed URL to display the interactive web calendar iframe here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              style={{
                marginTop: 6,
                padding: '10px 22px',
                borderRadius: 10,
                border: 'none',
                background: '#0284c7',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              }}
            >
              <i className="fas fa-gear" /> Configure Embed URL
            </button>
          </div>
        )
      )}

      {/* Event Details Popover / Modal */}
      <Modal
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title || 'Event Details'}
        icon="fas fa-calendar-day"
        maxWidth={520}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setSelectedEvent(null)}
            >
              Close
            </button>
          </div>
        }
      >
        {selectedEvent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '2.2rem' }}>{selectedEvent.emoji || '📅'}</span>
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: selectedEvent.all_day ? '#4ade80' : '#38bdf8',
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${selectedEvent.color || '#38bdf8'}44`,
                  }}
                >
                  {selectedEvent.time_display || 'All Day'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.9rem', color: '#cbd5e1' }}>
              <div>
                <strong style={{ color: '#94a3b8', display: 'block', marginBottom: 2 }}>📅 Date:</strong>
                {new Date(`${selectedEvent.start_date_iso}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>

              {selectedEvent.location && (
                <div>
                  <strong style={{ color: '#94a3b8', display: 'block', marginBottom: 2 }}>📍 Location:</strong>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(selectedEvent.location)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#38bdf8', textDecoration: 'none' }}
                  >
                    {selectedEvent.location} &rarr;
                  </a>
                </div>
              )}

              {selectedEvent.description && (
                <div>
                  <strong style={{ color: '#94a3b8', display: 'block', marginBottom: 2 }}>📝 Description:</strong>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, color: '#e2e8f0' }}>
                    {selectedEvent.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
