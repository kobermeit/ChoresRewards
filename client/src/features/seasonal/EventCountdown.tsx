import React, { useState, useEffect } from 'react';
import { SeasonalEvent } from '../../store/api';
import './eventCountdown.css';

interface EventCountdownProps {
  event: SeasonalEvent;
  accent?: string | null;
  emoji?: string | null;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isToday: boolean;
  isPast: boolean;
}

function calculateTimeRemaining(eventDateIso: string): TimeRemaining {
  // Event target is midnight at the start of event date (local time)
  // E.g. "2026-12-25" -> new Date(2026, 11, 25, 0, 0, 0)
  const parts = eventDateIso.split('-').map(Number);
  const targetYear = parts[0];
  const targetMonth = parts[1] - 1; // 0-indexed
  const targetDay = parts[2];

  const target = new Date(targetYear, targetMonth, targetDay, 0, 0, 0);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  // If now is on the same calendar day as target: "Today is the event!" (stays on 0 for a day)
  const isSameDay =
    now.getFullYear() === targetYear &&
    now.getMonth() === targetMonth &&
    now.getDate() === targetDay;

  if (isSameDay) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isToday: true, isPast: false };
  }

  if (diffMs <= 0) {
    // Past the event day
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isToday: false, isPast: true };
  }

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / (3600 * 24));
  const hours = Math.floor((totalSec % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return { days, hours, minutes, seconds, isToday: false, isPast: false };
}

export const EventCountdown: React.FC<EventCountdownProps> = React.memo(({ event, accent, emoji }) => {
  const [timeLeft, setTimeLeft] = useState<TimeRemaining>(() =>
    event.date ? calculateTimeRemaining(event.date) : { days: 0, hours: 0, minutes: 0, seconds: 0, isToday: false, isPast: true }
  );

  useEffect(() => {
    if (!event.date) return;

    const update = () => {
      setTimeLeft(calculateTimeRemaining(event.date!));
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [event.date]);

  // If no date or past the event day (> 24 hours after target date midnight), hide the counter
  if (!event.date || timeLeft.isPast) {
    return (
      <span
        className="header-seasonal-badge"
        style={{
          fontSize: '0.74rem',
          fontWeight: 700,
          color: accent || '#f8fafc',
          background: 'rgba(255, 255, 255, 0.08)',
          border: `1px solid ${accent ? accent + '55' : 'rgba(255, 255, 255, 0.15)'}`,
          padding: '2px 8px',
          borderRadius: '12px',
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span>{emoji || event.emoji}</span>
        <span className="header-seasonal-name">{event.name}</span>
      </span>
    );
  }

  const effectiveEmoji = event.emoji || (event.key === 'christmas' ? '🎅' : emoji || '🎉');
  const effectiveAccent = event.accent || (event.key === 'christmas' ? '#ef4444' : accent || '#ef4444');

  // If today is the event!
  if (timeLeft.isToday) {
    return (
      <div
        className="cr-event-countdown cr-event-countdown--today"
        style={{
          background: `linear-gradient(135deg, ${effectiveAccent}, #15803d)`,
        }}
        title={`Today is ${event.name}!`}
      >
        <span className="cr-event-countdown__emoji">{effectiveEmoji}</span>
        <span className="cr-event-countdown__today-text">
          Today is {event.name}! 🎉
        </span>
      </div>
    );
  }

  // Active countdown: Days, Hours, Mins, Secs (Santa Tracker style pill)
  return (
    <div
      className="cr-event-countdown"
      style={{
        background: `linear-gradient(135deg, ${effectiveAccent}, ${effectiveAccent === '#ef4444' ? '#dc2626' : '#1e293b'})`,
      }}
      title={`Countdown to ${event.name} (${event.date})`}
    >
      <span className="cr-event-countdown__emoji">{effectiveEmoji}</span>

      <div className="cr-event-countdown__unit">
        <span className="cr-event-countdown__val">
          {timeLeft.days}
        </span>
        <span className="cr-event-countdown__label">DAYS</span>
      </div>

      <span className="cr-event-countdown__divider" />

      <div className="cr-event-countdown__unit">
        <span className="cr-event-countdown__val">
          {String(timeLeft.hours).padStart(2, '0')}
        </span>
        <span className="cr-event-countdown__label">HRS</span>
      </div>

      <span className="cr-event-countdown__divider" />

      <div className="cr-event-countdown__unit">
        <span className="cr-event-countdown__val">
          {String(timeLeft.minutes).padStart(2, '0')}
        </span>
        <span className="cr-event-countdown__label">MIN</span>
      </div>

      <span className="cr-event-countdown__divider" />

      <div className="cr-event-countdown__unit">
        <span className="cr-event-countdown__val">
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
        <span className="cr-event-countdown__label">SEC</span>
      </div>
    </div>
  );
});

EventCountdown.displayName = 'EventCountdown';
