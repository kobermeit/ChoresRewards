import React, { memo } from 'react';
import { CalendarEvent } from '../../../types';
import { Button } from '../../../components/ui';
import { CalendarCell, DAY_NAMES, MONTH_NAMES } from '../calendarUtils';

interface CalendarMonthViewProps {
  currentYear: number;
  currentMonth: number;
  calendarCells: CalendarCell[];
  eventsThisMonthCount: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = memo(({
  currentYear,
  currentMonth,
  calendarCells,
  eventsThisMonthCount,
  onPrevMonth,
  onNextMonth,
  onToday,
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
          <Button variant="secondary" size="sm" onClick={onToday}>
            Today
          </Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={onPrevMonth}
              icon="fas fa-chevron-left"
              title="Previous Month"
              style={{ minWidth: 32, padding: 0 }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={onNextMonth}
              icon="fas fa-chevron-right"
              title="Next Month"
              style={{ minWidth: 32, padding: 0 }}
            />
          </div>

          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>
          {eventsThisMonthCount} events this month
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
        {DAY_NAMES.map((day) => (
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
                  onClick={() => onSelectEvent(ev)}
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
                  onClick={() => onSelectEvent(cell.events[3])}
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
  );
});
