import React from 'react';
import { useApp } from '../../context/AppContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { Modal } from '../../components/common/Modal';
import { DurationStepper, TimerRing } from '../../components/ui';

export const VisualTimerModal: React.FC = () => {
  const {
    visualTimerOpen,
    setVisualTimerOpen,
    timerTotalSeconds,
    timerRemainingSeconds,
    timerRunning,
    startTimer,
    pauseTimer,
    resetTimer,
    setTimerDurationSeconds,
  } = useApp();
  useBodyScrollLock(visualTimerOpen);

  const mins = Math.floor(timerRemainingSeconds / 60);
  const secs = timerRemainingSeconds % 60;
  const pct = timerTotalSeconds > 0 ? timerRemainingSeconds / timerTotalSeconds : 0;
  const strokeColor = pct > 0.35 ? '#0097a7' : pct > 0.15 ? '#f59e0b' : '#ef4444';

  const handleDurationChange = (newTotal: number) => {
    const clamped = Math.max(0, newTotal);
    setTimerDurationSeconds(clamped);
  };

  return (
    <>
      {/* Floating Always-On-Top Mini Timer Pill when active in background */}
      {timerRunning && !visualTimerOpen && (
        <div
          onClick={() => setVisualTimerOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 99990,
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
            border: `2px solid ${strokeColor}`,
            borderRadius: '24px',
            padding: '8px 16px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            boxShadow: `0 8px 24px ${strokeColor}44`,
            backdropFilter: 'blur(10px)',
            transition: 'all 0.25s ease',
          }}
          title="Visual Timer is running — tap to open"
        >
          <i className="fas fa-stopwatch" style={{ color: strokeColor, fontSize: '1.1rem' }} />
          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '1px' }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span style={{ fontSize: '0.72rem', color: strokeColor, textTransform: 'uppercase', fontWeight: 800 }}>
            {timerRemainingSeconds === 0 ? "Time's Up!" : 'Active'}
          </span>
        </div>
      )}

      {visualTimerOpen && (
        <Modal
          open={visualTimerOpen}
          onClose={() => setVisualTimerOpen(false)}
          title="Timer"
          icon="fas fa-stopwatch"
          maxWidth={380}
        >
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Unified Duration Stepper (-30s, MM:SS, +30s) */}
            <div style={{ marginBottom: 16 }}>
              <DurationStepper
                totalSeconds={timerTotalSeconds}
                onChange={handleDurationChange}
                minSeconds={0}
                stepSeconds={30}
              />
            </div>

            {/* Circular SVG Ring & Time Digits */}
            <div
              style={{
                width: 240,
                height: 240,
                margin: '0 auto 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TimerRing
                fraction={pct}
                color={strokeColor}
                label={`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
                caption={timerRemainingSeconds === 0 && timerTotalSeconds > 0 ? "TIME'S UP!" : timerRunning ? 'ACTIVE' : 'READY'}
                strokeWidth={5}
              />
            </div>

            {/* Play/Pause + Reset */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  if (timerRunning) {
                    pauseTimer();
                  } else {
                    startTimer();
                  }
                }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  border: 'none',
                  background: timerRunning ? '#f59e0b' : '#0097a7',
                  color: '#ffffff',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: timerRunning
                    ? '0 4px 16px rgba(245, 158, 11, 0.4)'
                    : '0 4px 16px rgba(0, 151, 167, 0.45)',
                  transition: 'all 0.15s ease',
                }}
                title={timerRunning ? 'Pause timer' : 'Start timer'}
                aria-label={timerRunning ? 'Pause timer' : 'Start timer'}
              >
                <i className={timerRunning ? 'fas fa-pause' : 'fas fa-play'} style={{ marginLeft: timerRunning ? 0 : 2 }} />
              </button>

              <button
                type="button"
                onClick={resetTimer}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                title="Reset to beginning"
                aria-label="Reset to beginning"
              >
                <i className="fas fa-rotate-left" />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
