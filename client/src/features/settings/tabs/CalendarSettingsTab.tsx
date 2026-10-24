import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { apiGet, apiPost, resolveAvatarUrl } from '../../../api';
import { Button, Input, FormErrorAlert } from '../../../components/ui';

export interface CalendarSettingsTabProps {
  initialSettings?: any;
  onUpdated?: () => void;
}

export const CalendarSettingsTab: React.FC<CalendarSettingsTabProps> = ({ initialSettings, onUpdated }) => {
  const { data, refresh, showToast, openEditMemberModal } = useApp();
  const [calEnabled, setCalEnabled] = useState(false);
  const [calIcalUrl, setCalIcalUrl] = useState('');
  const [calEmbedUrl, setCalEmbedUrl] = useState('');
  const [calFormError, setCalFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSettings) {
      setCalEnabled(Boolean(initialSettings.google_calendar_enabled ?? initialSettings.google_calendar?.enabled));
      setCalIcalUrl(initialSettings.gcal_ical_url || initialSettings.google_calendar?.ical_url || '');
      setCalEmbedUrl(initialSettings.gcal_embed_url || initialSettings.google_calendar?.embed_url || '');
    } else {
      apiGet<any>('settings_data').then((res) => {
        if (res?.google_calendar || res?.gcal_ical_url !== undefined) {
          setCalEnabled(Boolean(res.google_calendar_enabled ?? res.google_calendar?.enabled));
          setCalIcalUrl(res.gcal_ical_url || res.google_calendar?.ical_url || '');
          setCalEmbedUrl(res.gcal_embed_url || res.google_calendar?.embed_url || '');
        }
      }).catch(() => {});
    }
  }, [initialSettings]);

  const handleSaveCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalFormError(null);
    try {
      await apiPost('save_calendar_settings', {
        google_calendar_enabled: calEnabled,
        gcal_ical_url: calIcalUrl.trim(),
        gcal_embed_url: calEmbedUrl.trim(),
      });
      showToast('Saved Google Calendar settings');
      await refresh();
      onUpdated?.();
    } catch (err: any) {
      const msg = err.message || 'Failed to save calendar settings';
      setCalFormError(msg);
      showToast(msg, { type: 'error' });
    }
  };

  return (
    <form onSubmit={handleSaveCalendar} className="card" style={{ padding: 24, borderRadius: 18, maxWidth: 680 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>📅 Google Calendar Integration</h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--cr-text-secondary)' }}>
            Sync family events and activities into your Dashboard and Calendar views.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon="fas fa-rotate"
          disabled={!calEnabled}
          title={!calEnabled ? 'Enable Calendar Sync below to sync events' : 'Sync latest events from Google'}
          onClick={async () => {
            if (!calEnabled) {
              showToast('Please enable Google Calendar Sync first', { type: 'error' });
              return;
            }
            const res = await apiPost<any>('sync_calendar', {});
            if (res?.error) {
              showToast(`Sync warning: ${res.error}`, { type: 'error' });
            } else {
              showToast('Calendar synced with Google!');
            }
            await refresh();
          }}
        >
          Sync Now
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormErrorAlert error={calFormError} onDismiss={() => setCalFormError(null)} />

        {/* Master Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderRadius: 14,
            background: calEnabled ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            border: calEnabled ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--color-border-subtle)',
            transition: 'all 0.2s ease',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--cr-text-primary)' }}>
              Enable Google Calendar Sync
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--cr-text-secondary)' }}>
              {calEnabled ? 'Events will be automatically fetched on schedule' : 'Sync is paused. Enable to fetch shared & personal calendars.'}
            </div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26, margin: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={calEnabled}
              onChange={(e) => setCalEnabled(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: calEnabled ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
                transition: '.2s',
                borderRadius: 34,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: "''",
                  height: 20,
                  width: 20,
                  left: calEnabled ? 24 : 3,
                  bottom: 3,
                  backgroundColor: 'white',
                  transition: '.2s',
                  borderRadius: '50%',
                }}
              />
            </span>
          </label>
        </div>

        {/* Child Inputs Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            opacity: calEnabled ? 1 : 0.45,
            pointerEvents: calEnabled ? 'auto' : 'none',
            transition: 'opacity 0.2s ease',
          }}
        >
          <Input
            label="Whole-Family Shared Calendar (.ics URL)"
            type="url"
            placeholder="https://calendar.google.com/calendar/ical/.../private-.../basic.ics"
            value={calIcalUrl}
            disabled={!calEnabled}
            onChange={(e) => setCalIcalUrl(e.target.value)}
            helperText="Events from this shared family calendar will appear in Gold / Yellow (or mapped to a person if their name is in the event title)."
          />

          <Input
            label="Combined Google Calendar Embed URL (Optional for Iframe View)"
            type="url"
            placeholder="https://calendar.google.com/calendar/embed?src=..."
            value={calEmbedUrl}
            disabled={!calEnabled}
            onChange={(e) => setCalEmbedUrl(e.target.value)}
            helperText="In Google Calendar settings &rarr; 'Integrate calendar', click Customise to select all family sub-calendars together in one single combined embed view."
          />

          {/* Family Members Sub-Calendars Summary */}
          <div
            style={{
              marginTop: 4,
              padding: 16,
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                👨‍👩‍👧‍👦 Individual Family Member Sub-Calendars
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                Sub-calendars are configured per person so their events appear in their own personal accent colour.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(data?.family || []).map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.04)',
                    borderLeft: `4px solid ${m.color || '#3b82f6'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img
                      src={resolveAvatarUrl(m.avatar)}
                      alt={m.name}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                      }}
                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{m.name}</span>
                    {m.calendar_ical_url ? (
                      <span style={{ fontSize: '0.72rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <i className="fas fa-check-circle" /> Connected
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        No personal calendar set
                      </span>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="fas fa-edit"
                    onClick={() => openEditMemberModal(m)}
                  >
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          icon="fas fa-save"
        >
          Save Calendar Settings
        </Button>
      </div>
    </form>
  );
};

export default CalendarSettingsTab;
