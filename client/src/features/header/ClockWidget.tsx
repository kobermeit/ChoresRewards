import React, { useState, useEffect } from 'react';

export interface ClockWidgetProps {
  timezone?: string;
  headerMinimized?: boolean;
}

export const ClockWidget: React.FC<ClockWidgetProps> = ({
  timezone,
  headerMinimized = false,
}) => {
  const [clockTime, setClockTime] = useState('--:--');
  const [clockDate, setClockDate] = useState('Loading…');

  useEffect(() => {
    const tz = timezone && timezone !== 'UTC' ? timezone : Intl.DateTimeFormat().resolvedOptions().timeZone;

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
  }, [timezone]);

  return (
    <div
      id="clock-widget"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        color: 'var(--cr-text-primary)',
        flexShrink: 0,
        padding: '0 4px',
        lineHeight: 1.1,
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
  );
};
