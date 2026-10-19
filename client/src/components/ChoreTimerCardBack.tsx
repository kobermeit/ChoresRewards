import React from 'react';
import { useTimer, ActiveChoreTimer } from '../context/TimerContext';
import { Chore, Person } from '../types';

interface ChoreTimerCardBackProps {
  chore: Chore;
  person?: Person;
  onFlipBack: () => void;
  onComplete: () => void;
}

export const ChoreTimerCardBack: React.FC<ChoreTimerCardBackProps> = ({
  chore,
  person,
  onFlipBack,
  onComplete,
}) => {
  const {
    getChoreTimer,
    startChoreTimer,
    pauseChoreTimer,
    resumeChoreTimer,
    resetChoreTimer,
  } = useTimer();

  const timer = getChoreTimer(chore.id);
  const total = timer ? timer.totalSeconds : (chore.duration_seconds || 600);
  const remaining = timer ? timer.remainingSeconds : total;
  const isRunning = timer ? timer.isRunning : false;

  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  // Dynamic % color thresholds:
  // > 35%: Calm green (#10b981)
  // 15% - 35%: Warning amber (#f59e0b)
  // < 15%: Urgent red (#ef4444)
  const timerColor = pct > 35 ? '#10b981' : pct > 15 ? '#f59e0b' : '#ef4444';
  const memberAccent = person?.color || '#3b82f6';

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  // SVG circular geometry
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div
      className="cr-item-card cr-chore-timer-card-back"
      style={{
        background: 'linear-gradient(150deg, #1e293b 0%, #0f172a 100%)',
        border: `1.5px solid ${timerColor}66`,
        borderTop: `3px solid ${timerColor}`,
        borderRadius: 'var(--card-radius, 16px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: `0 8px 24px rgba(0, 0, 0, 0.4), 0 0 20px ${timerColor}22`,
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        padding: '14px 14px 16px',
        justifyContent: 'space-between',
        position: 'relative',
      }}
    >
      {/* Top Bar: Chore Title & Flip Back */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.94rem',
              fontWeight: 800,
              color: '#f8fafc',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={chore.title}
          >
            {chore.title}
          </div>
        </div>

        <button
          type="button"
          onClick={onFlipBack}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            color: '#cbd5e1',
            borderRadius: '8px',
            width: 30,
            height: 30,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          title="Flip back to chore card"
          aria-label="Flip back to chore card"
        >
          <i className="fas fa-rotate" />
        </button>
      </div>

      {/* Center: Circular Progress Ring & Countdown Display */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '4px auto',
        }}
      >
        <svg width="116" height="116" viewBox="0 0 116 116" style={{ transform: 'rotate(-90deg)' }}>
          {/* Background Track */}
          <circle
            cx="58"
            cy="58"
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="8"
          />
          {/* Progress Indicator */}
          <circle
            cx="58"
            cy="58"
            r={radius}
            fill="transparent"
            stroke={timerColor}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease',
            }}
          />
        </svg>

        {/* Inner Content */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: '1.75rem',
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
              color: '#ffffff',
              lineHeight: 1,
              filter: `drop-shadow(0 2px 8px ${timerColor}66)`,
            }}
          >
            {timeFormatted}
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: timerColor,
              marginTop: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {remaining === 0 ? 'Time Up!' : isRunning ? 'Active' : 'Paused'}
          </span>
        </div>
      </div>

      {/* Control Buttons Row */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Play/Pause Toggle */}
        <button
          type="button"
          onClick={() => {
            if (!timer) {
              startChoreTimer(chore);
            } else if (isRunning) {
              pauseChoreTimer(chore.id);
            } else {
              resumeChoreTimer(chore.id);
            }
          }}
          style={{
            flex: 1,
            height: 36,
            borderRadius: 'var(--btn-radius, 8px)',
            border: isRunning
              ? '1px solid rgba(245, 158, 11, 0.5)'
              : '1px solid rgba(16, 185, 129, 0.6)',
            background: isRunning
              ? 'rgba(245, 158, 11, 0.18)'
              : 'rgba(16, 185, 129, 0.22)',
            color: isRunning ? '#fcd34d' : '#6ee7b7',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
        >
          <i className={isRunning ? 'fas fa-pause' : 'fas fa-play'} />
          <span>{isRunning ? 'Pause' : 'Resume'}</span>
        </button>

        {/* Reset Button */}
        <button
          type="button"
          onClick={() => resetChoreTimer(chore.id)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--btn-radius, 8px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(255, 255, 255, 0.06)',
            color: '#cbd5e1',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.82rem',
            transition: 'all 0.15s ease',
          }}
          title="Reset timer to full duration"
          aria-label="Reset timer"
        >
          <i className="fas fa-rotate-left" />
        </button>

        {/* Complete Chore Button */}
        <button
          type="button"
          className="btn-complete-chore"
          style={{
            flex: 1.2,
            height: 36,
            borderRadius: 'var(--btn-radius, 8px)',
            fontSize: '0.82rem',
          }}
          onClick={onComplete}
        >
          <i className="fas fa-check" /> Done!
        </button>
      </div>
    </div>
  );
};
