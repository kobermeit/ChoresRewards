import React from 'react';
import { useTimer } from '../context/TimerContext';
import { useApp } from '../context/AppContext';

/**
 * Floating dock showing all currently ticking chore timers.
 * Appears fixed in the bottom-right corner when timers are active,
 * allowing kids and parents to navigate anywhere in the app without losing track of time.
 */
export const ActiveTimersMiniDock: React.FC = () => {
  const { activeTimerList, pauseChoreTimer, resumeChoreTimer, stopChoreTimer } = useTimer();
  const { setActiveView } = useApp();

  if (activeTimerList.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 320,
        pointerEvents: 'auto',
      }}
    >
      {activeTimerList.map((timer) => {
        const total = timer.totalSeconds || 120;
        const remaining = timer.remainingSeconds;
        const pct = Math.max(0, Math.min(100, (remaining / total) * 100));

        // Color based on % remaining
        const ringColor = pct <= 15 ? '#f43f5e' : pct <= 35 ? '#f59e0b' : '#10b981';

        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const timeDisplay = `${mins}:${secs.toString().padStart(2, '0')}`;

        return (
          <div
            key={timer.choreId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 16,
              background: 'rgba(15, 23, 42, 0.94)',
              backdropFilter: 'blur(16px)',
              border: `1.5px solid ${ringColor}60`,
              boxShadow: `0 10px 30px rgba(0, 0, 0, 0.5), 0 0 16px ${ringColor}30`,
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => setActiveView('chores')}
          >
            {/* Circular Mini Progress */}
            <div style={{ position: 'relative', width: 38, height: 38, flexShrink: 0 }}>
              <svg width="38" height="38" viewBox="0 0 38 38">
                <circle
                  cx="19"
                  cy="19"
                  r="15"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="3.5"
                />
                <circle
                  cx="19"
                  cy="19"
                  r="15"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="3.5"
                  strokeDasharray={94.2}
                  strokeDashoffset={94.2 - (94.2 * pct) / 100}
                  strokeLinecap="round"
                  transform="rotate(-90 19 19)"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                }}
              >
                ⏱️
              </div>
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--cr-text-primary, #f8fafc)',
                }}
              >
                {timer.choreTitle}
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: ringColor, fontFamily: 'monospace' }}>
                {timeDisplay} {timer.isRunning ? '' : '(Paused)'}
              </div>
            </div>

            {/* Micro Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => (timer.isRunning ? pauseChoreTimer(timer.choreId) : resumeChoreTimer(timer.choreId))}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                }}
                title={timer.isRunning ? 'Pause Timer' : 'Resume Timer'}
              >
                <i className={`fas ${timer.isRunning ? 'fa-pause' : 'fa-play'}`} />
              </button>
              <button
                type="button"
                onClick={() => stopChoreTimer(timer.choreId)}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  color: '#f87171',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                }}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
