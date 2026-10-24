import React, { memo } from 'react';
import { CalendarEvent } from '../../../types';

interface CalendarScheduleViewProps {
  scheduleEvents: CalendarEvent[];
  scheduleGroups: Record<string, CalendarEvent[]>;
  localToday: string;
  onSelectEvent: (event: CalendarEvent) => void;
}

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = memo(({
  scheduleEvents,
  scheduleGroups,
  localToday,
  onSelectEvent,
}) => {
  return (
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
                      onClick={() => onSelectEvent(ev)}
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
  );
});
