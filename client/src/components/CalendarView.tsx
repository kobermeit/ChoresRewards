import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CalendarEvent } from '../types';
import { apiPost, resolveAvatarUrl } from '../api';
import { Modal } from './common/Modal';
import { FormErrorAlert } from './FormErrorAlert';

export const CalendarView: React.FC = () => {
  const { data, refresh, showToast, isParent, setActiveView } = useApp();
  const [viewMode, setViewMode] = useState<'month' | 'schedule' | 'embed'>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [personFilter, setPersonFilter] = useState<string>('all');

  // Settings form state (for initial onboarding when calendar has not been setup)
  const gcal = data?.google_calendar;
  const [icalUrlInput, setIcalUrlInput] = useState(gcal?.ical_url || '');
  const [embedUrlInput, setEmbedUrlInput] = useState(gcal?.embed_url || '');
  const [savingSettings, setSavingSettings] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Calendar month navigation state
  const todayDate = new Date();
  const [currentYear, setCurrentYear] = useState(todayDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(todayDate.getMonth()); // 0-indexed

  if (!data) return null;

  const rawEvents: CalendarEvent[] = gcal?.events || [];
  const kidsGroup = data?.groups?.find((g) => g.id === 'kids');
  const kidsIds = new Set(
    kidsGroup?.member_ids ||
      (data?.family || []).filter((m) => m.role === 'child').map((m) => m.id)
  );

  const events = rawEvents.filter((e) => {
    if (personFilter === 'all') return true;
    if (personFilter === 'kids') {
      return (
        (e.person_id !== null && e.person_id !== undefined && kidsIds.has(Number(e.person_id))) ||
        e.person_name?.toLowerCase() === 'kids'
      );
    }
    return (
      String(e.person_id) === personFilter ||
      e.person_name?.toLowerCase() === personFilter.toLowerCase()
    );
  });
  const localToday = data.current_date; // YYYY-MM-DD
  const hasConfig = Boolean(
    gcal?.ical_url ||
    gcal?.embed_url ||
    (data?.family || []).some((m) => m.calendar_ical_url)
  );

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

  const handleSaveInitialSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSavingSettings(true);
    try {
      await apiPost('save_calendar_settings', {
        gcal_ical_url: icalUrlInput.trim(),
        gcal_embed_url: embedUrlInput.trim(),
        google_calendar_enabled: true,
      });
      showToast('Calendar settings saved and synced!', { type: 'success' });
      await refresh();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save calendar settings';
      setFormError(msg);
      showToast(msg, { type: 'error' });
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
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const mondayOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

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

  // Schedule view: group upcoming events from today onwards
  const scheduleEvents = [...events]
    .filter((e) => e.start_date_iso >= localToday)
    .sort((a, b) => {
      if (a.start_date_iso !== b.start_date_iso) return a.start_date_iso.localeCompare(b.start_date_iso);
      if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
      return (a.start_time_sort || '00:00').localeCompare(b.start_time_sort || '00:00');
    });

  const scheduleGroups: Record<string, CalendarEvent[]> = {};
  for (const ev of scheduleEvents) {
    if (!scheduleGroups[ev.start_date_iso]) scheduleGroups[ev.start_date_iso] = [];
    scheduleGroups[ev.start_date_iso].push(ev);
  }

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
          marginBottom: 18,
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(12px)',
          padding: '14px 20px',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.25)',
            }}
          >
            📅
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
              Family Calendar
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
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
              onClick={() => setViewMode('schedule')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: viewMode === 'schedule' ? '#0284c7' : 'transparent',
                color: viewMode === 'schedule' ? '#ffffff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              <i className="fas fa-list-ul" /> Schedule
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
        </div>
      </div>

      {/* Person Filter Pills Bar (Active in Month and Schedule views) */}
      {viewMode !== 'embed' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setPersonFilter('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: personFilter === 'all' ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
              background: personFilter === 'all' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.04)',
              color: personFilter === 'all' ? '#38bdf8' : '#cbd5e1',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              transition: 'all 0.12s ease',
            }}
          >
            <span>✨</span> All Events ({rawEvents.length})
          </button>

          {kidsIds.size > 0 && (
            <button
              type="button"
              onClick={() => setPersonFilter('kids')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: personFilter === 'kids' ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.1)',
                background: personFilter === 'kids' ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255,255,255,0.04)',
                color: personFilter === 'kids' ? '#f472b6' : '#cbd5e1',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'all 0.12s ease',
              }}
            >
              <span>👧</span> Kids ({rawEvents.filter((e) =>
                (e.person_id !== null && e.person_id !== undefined && kidsIds.has(Number(e.person_id))) ||
                e.person_name?.toLowerCase() === 'kids'
              ).length})
            </button>
          )}

          {(data?.family || []).map((m) => {
            const count = rawEvents.filter(
              (e) => String(e.person_id) === String(m.id) || e.person_name?.toLowerCase() === m.name.toLowerCase()
            ).length;
            const isSelected = personFilter === String(m.id) || personFilter === m.name;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setPersonFilter(String(m.id))}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: isSelected ? `2px solid ${m.color || '#3b82f6'}` : '1px solid rgba(255,255,255,0.1)',
                  background: isSelected ? `${m.color || '#3b82f6'}33` : 'rgba(255,255,255,0.04)',
                  color: isSelected ? '#ffffff' : '#cbd5e1',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.12s ease',
                }}
              >
                <img
                  src={resolveAvatarUrl(m.avatar)}
                  alt={m.name}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                  }}
                  style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
                />
                <span>{m.name}</span>
                <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Setup & Connection Banner: ONLY shown when calendar has NOT been set up yet */}
      {!hasConfig && (
        isParent ? (
          <div
            style={{
              marginBottom: 20,
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
                  <li>(Optional) You can also copy the <strong>"Embed code"</strong> URL for the interactive dark mode Google Calendar iframe.</li>
                </ol>
              </div>
            </div>

            <form onSubmit={handleSaveInitialSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormErrorAlert error={formError} onDismiss={() => setFormError(null)} />

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                  Secret address in iCal format (.ics URL):
                </label>
                <input
                  type="url"
                  value={icalUrlInput}
                  onChange={(e) => {
                    setFormError(null);
                    setIcalUrlInput(e.target.value);
                  }}
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
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                  Google Calendar Embed URL (Optional for iframe view):
                </label>
                <input
                  type="url"
                  value={embedUrlInput}
                  onChange={(e) => {
                    setFormError(null);
                    setEmbedUrlInput(e.target.value);
                  }}
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
        ) : (
          <div
            style={{
              marginBottom: 20,
              padding: '16px 20px',
              borderRadius: 14,
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.15rem',
                flexShrink: 0,
              }}
            >
              <i className="fas fa-calendar-alt" />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.94rem' }}>
                Google Calendar Not Connected
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 2 }}>
                Switch to a Parent profile to connect your family Google Calendar in Settings.
              </div>
            </div>
          </div>
        )
      )}

      {/* 1. MONTH VIEW (Single Unified Section) */}
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
          {/* Narrow Controls Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={goToday}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#f8fafc',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                Today
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={prevMonth}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                  }}
                  title="Previous Month"
                >
                  <i className="fas fa-chevron-left" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                  }}
                  title="Next Month"
                >
                  <i className="fas fa-chevron-right" />
                </button>
              </div>

              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                {monthNames[currentMonth]} {currentYear}
              </h2>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>
              {events.filter((e) => e.start_date_iso.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`)).length} events this month
            </div>
          </div>

          {/* Day of Week Headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              background: 'rgba(255, 255, 255, 0.02)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '0.78rem',
              color: '#94a3b8',
              letterSpacing: '0.5px',
            }}
          >
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
              <div key={day} style={{ padding: '8px 4px' }}>
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
                      {ev.person_name && ev.person_name !== 'Family' && (
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: `${ev.color || '#38bdf8'}33`,
                            color: ev.color || '#38bdf8',
                            marginLeft: 'auto',
                            flexShrink: 0,
                          }}
                        >
                          {ev.person_name}
                        </span>
                      )}
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

      {/* 2. SCHEDULE VIEW (Mimicking Google Calendar Embed Schedule Layout) */}
      {viewMode === 'schedule' && (
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
          {/* Schedule Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                Upcoming Schedule
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                ({scheduleEvents.length} {scheduleEvents.length === 1 ? 'event' : 'events'})
              </span>
            </div>
          </div>

          {scheduleEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🌴</div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>No upcoming events scheduled</h3>
              <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '0.86rem' }}>
                Enjoy your free time, or tap "Sync Now" to refresh from Google Calendar.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {Object.entries(scheduleGroups).map(([dateIso, dayEvents], groupIdx) => {
                const isToday = dateIso === localToday;
                const dateObj = new Date(`${dateIso}T00:00:00`);
                const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
                const monthDay = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                return (
                  <div
                    key={dateIso}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '130px 1fr',
                      borderBottom: groupIdx < Object.keys(scheduleGroups).length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                      background: isToday ? 'rgba(2, 132, 199, 0.06)' : 'transparent',
                    }}
                  >
                    {/* Left Date Column */}
                    <div
                      style={{
                        padding: '14px 16px',
                        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: isToday ? '#38bdf8' : '#e2e8f0' }}>
                        {dayName}, {monthDay}
                      </span>
                      {isToday && (
                        <span
                          style={{
                            alignSelf: 'flex-start',
                            background: '#0284c7',
                            color: '#ffffff',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: '0.68rem',
                            fontWeight: 700,
                          }}
                        >
                          TODAY
                        </span>
                      )}
                    </div>

                    {/* Right Events Column */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {dayEvents.map((ev, evIdx) => (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 16px',
                            borderBottom: evIdx < dayEvents.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                            cursor: 'pointer',
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          {/* Time */}
                          <div
                            style={{
                              width: 140,
                              flexShrink: 0,
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: ev.all_day ? '#4ade80' : '#cbd5e1',
                            }}
                          >
                            {ev.time_display || 'All Day'}
                          </div>

                          {/* Dot */}
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: ev.color || '#38bdf8',
                              flexShrink: 0,
                              boxShadow: `0 0 6px ${ev.color || '#38bdf8'}88`,
                            }}
                          />

                          {/* Title & Location */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '1rem', flexShrink: 0 }}>{ev.emoji || '📅'}</span>
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: '0.92rem',
                                color: '#f8fafc',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {ev.title}
                            </span>
                            {ev.location && (
                              <span
                                style={{
                                  fontSize: '0.78rem',
                                  color: '#94a3b8',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  marginLeft: 6,
                                }}
                              >
                                📍 {ev.location}
                              </span>
                            )}
                          </div>

                          {/* Person Badge */}
                          {ev.person_name && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '3px 9px',
                                borderRadius: 12,
                                background: `${ev.color || '#38bdf8'}22`,
                                color: ev.color || '#38bdf8',
                                border: `1px solid ${ev.color || '#38bdf8'}44`,
                                flexShrink: 0,
                                marginLeft: 'auto',
                              }}
                            >
                              {ev.person_name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. GOOGLE CALENDAR EMBED VIEW (DARK MODE) */}
      {viewMode === 'embed' && (
        gcal?.embed_url ? (
          <div
            style={{
              background: '#0f172a',
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
                filter: 'invert(0.92) hue-rotate(180deg) contrast(0.95)',
                background: '#0f172a',
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
                To view the interactive Google Calendar embed here, add your Embed URL in Settings.
              </p>
            </div>
            {isParent ? (
              <button
                type="button"
                onClick={() => setActiveView('settings')}
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
                <i className="fas fa-gear" /> Configure in Settings
              </button>
            ) : (
              <p style={{ color: '#64748b', fontSize: '0.86rem', marginTop: 4 }}>
                Switch to a Parent profile to configure the Google Calendar Embed URL in Settings.
              </p>
            )}
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

              {selectedEvent.person_name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                  <strong style={{ color: '#94a3b8' }}>👤 Calendar:</strong>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: selectedEvent.color || '#38bdf8',
                      background: `${selectedEvent.color || '#38bdf8'}22`,
                      border: `1px solid ${selectedEvent.color || '#38bdf8'}44`,
                      padding: '2px 8px',
                      borderRadius: 8,
                    }}
                  >
                    {selectedEvent.person_name}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
