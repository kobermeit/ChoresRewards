import React, { memo } from 'react';
import { CalendarEvent } from '../../../types';

export interface CalendarEventsWidgetProps {
  dateFilter: 'today' | 'tomorrow' | 'week';
  events: CalendarEvent[];
  onOpenCalendar: () => void;
}

export const CalendarEventsWidget: React.FC<CalendarEventsWidgetProps> = memo(({
  dateFilter,
  events,
  onOpenCalendar,
}) => {
  const title =
    dateFilter === 'tomorrow'
      ? "What's on Tomorrow"
      : dateFilter === 'week'
      ? "What's on This Week"
      : "What's on Today";

  return (
    <div
      className="dashboard-card"
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}
      onClick={onOpenCalendar}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-calendar-day" style={{ color: '#38bdf8' }} />
          <span>{title}</span>
        </h3>
        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Calendar &rarr;</span>
      </div>

      {events.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 8px',
            textAlign: 'center',
            gap: 4,
          }}
        >
          <span style={{ fontSize: '1.6rem' }}>☀️</span>
          <p className="dash-empty-hint" style={{ margin: 0 }}>
            No events scheduled for {dateFilter}.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.slice(0, 4).map((ev) => (
            <div
              key={ev.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.04)',
                borderLeft: `3px solid ${ev.color || '#38bdf8'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '1.1rem' }}>{ev.emoji || '📅'}</span>
                <span
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    color: '#f8fafc',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {ev.title}
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: ev.all_day ? '#4ade80' : '#38bdf8',
                  background: 'rgba(0,0,0,0.25)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                {ev.time_display || 'All Day'}
              </span>
            </div>
          ))}
          {events.length > 4 && (
            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, textAlign: 'center' }}>
              +{events.length - 4} more events on calendar
            </div>
          )}
        </div>
      )}
    </div>
  );
});

CalendarEventsWidget.displayName = 'CalendarEventsWidget';
