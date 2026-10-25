import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CalendarEvent } from '../../types';
import { apiPost, resolveAvatarUrl } from '../../api';
import { FormErrorAlert } from '../../components/FormErrorAlert';
import { Button, Card, Input } from '../../components/ui';
import { buildCalendarCells, buildScheduleGroups } from './calendarUtils';
import { CalendarMonthView } from './components/CalendarMonthView';
import { CalendarScheduleView } from './components/CalendarScheduleView';
import { CalendarEventModal } from './components/CalendarEventModal';

export const CalendarView: React.FC = () => {
  const { data, refresh, showToast, isParent, setActiveView } = useApp();
  const [viewMode, setViewMode] = useState<'month' | 'schedule' | 'embed'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'schedule';
    }
    return 'month';
  });
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

  const calendarCells = buildCalendarCells(currentYear, currentMonth, events, localToday);
  const eventsThisMonthCount = events.filter((e) =>
    e.start_date_iso.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`)
  ).length;

  const { scheduleEvents, scheduleGroups } = buildScheduleGroups(events, localToday);

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
              borderRadius: 'var(--btn-radius)',
              border: '1px solid var(--color-border-subtle)',
              gap: 4,
            }}
          >
            <Button
              variant={viewMode === 'month' ? 'primary' : 'ghost'}
              size="sm"
              icon="fas fa-calendar-days"
              onClick={() => setViewMode('month')}
            >
              Month
            </Button>
            <Button
              variant={viewMode === 'schedule' ? 'primary' : 'ghost'}
              size="sm"
              icon="fas fa-list-ul"
              onClick={() => setViewMode('schedule')}
            >
              Schedule
            </Button>
            <Button
              variant={viewMode === 'embed' ? 'primary' : 'ghost'}
              size="sm"
              icon="fas fa-globe"
              onClick={() => setViewMode('embed')}
            >
              Embed View
            </Button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            isLoading={syncing}
            icon={syncing ? undefined : 'fas fa-rotate'}
            title="Refresh events from Google"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </div>

      {/* Person Filter Pills Bar */}
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

      {/* Initial Configuration Helper */}
      {!hasConfig && (
        isParent ? (
          <Card elevation={2} style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📅</span> Connect Family Google Calendar
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '0 0 16px', lineHeight: 1.5 }}>
              Paste your secret Google Calendar iCal address below to sync events directly into Family Hub.
            </p>
            <FormErrorAlert error={formError} />
            <form onSubmit={handleSaveInitialSettings} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input
                label="iCal Secret Address URL (.ics)"
                value={icalUrlInput}
                onChange={(e) => setIcalUrlInput(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                required
              />
              <Input
                label="Google Calendar Embed URL (Optional)"
                value={embedUrlInput}
                onChange={(e) => setEmbedUrlInput(e.target.value)}
                placeholder="https://calendar.google.com/calendar/embed?src=..."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <Button variant="primary" size="md" type="submit" isLoading={savingSettings}>
                  Save & Sync Calendar
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 14,
              background: 'rgba(2, 132, 199, 0.12)',
              border: '1px solid rgba(2, 132, 199, 0.3)',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ fontSize: '1.5rem', color: '#38bdf8' }}>
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

      {/* 1. MONTH VIEW */}
      {viewMode === 'month' && (
        <CalendarMonthView
          currentYear={currentYear}
          currentMonth={currentMonth}
          calendarCells={calendarCells}
          eventsThisMonthCount={eventsThisMonthCount}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onToday={goToday}
          onSelectEvent={setSelectedEvent}
        />
      )}

      {/* 2. SCHEDULE VIEW */}
      {viewMode === 'schedule' && (
        <CalendarScheduleView
          scheduleEvents={scheduleEvents}
          scheduleGroups={scheduleGroups}
          localToday={localToday}
          onSelectEvent={setSelectedEvent}
        />
      )}

      {/* 3. GOOGLE CALENDAR EMBED VIEW */}
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
      <CalendarEventModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
};
