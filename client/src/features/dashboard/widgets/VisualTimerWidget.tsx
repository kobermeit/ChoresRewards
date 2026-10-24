import React, { memo } from 'react';
import { Button, TimerRing } from '../../../components/ui';
import { SeasonalCardWatermark } from '../SeasonalCardWatermark';

export interface VisualTimerWidgetProps {
  timerPct: number;
  timerPieColor: string;
  timerDigits: string;
  timerRemainingSeconds: number;
  timerRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onOpenModal: () => void;
}

export const VisualTimerWidget: React.FC<VisualTimerWidgetProps> = memo(({
  timerPct,
  timerPieColor,
  timerDigits,
  timerRemainingSeconds,
  timerRunning,
  onStart,
  onPause,
  onReset,
  onOpenModal,
}) => {
  return (
    <div
      className="dashboard-card dashboard-card-timer"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}
    >
      <SeasonalCardWatermark variant={1} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-hourglass-half" style={{ color: '#38bdf8' }} />
          <span>Visual Timer</span>
        </h3>
        {timerRunning && (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#10b981',
              background: 'rgba(16, 185, 129, 0.15)',
              padding: '2px 8px',
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#10b981',
                animation: 'pulse 1.5s infinite',
              }}
            />
            Ticking
          </span>
        )}
      </div>

      <TimerRing
        fraction={timerPct}
        color={timerPieColor}
        label={timerDigits}
        caption={timerRunning ? 'Active' : timerRemainingSeconds === 0 ? 'Time Up!' : 'Ready'}
        onClick={onOpenModal}
        title="Click to open full timer modal"
      />

      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 'auto',
          paddingTop: 8,
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {timerRunning ? (
          <Button
            size="sm"
            variant="secondary"
            icon="fas fa-pause"
            onClick={onPause}
            title="Pause"
            aria-label="Pause"
            style={{ width: 38, height: 38, borderRadius: '50%', padding: 0 }}
          />
        ) : (
          <Button
            size="sm"
            variant="primary"
            icon="fas fa-play"
            onClick={onStart}
            title="Start"
            aria-label="Start"
            style={{ width: 38, height: 38, borderRadius: '50%', padding: 0 }}
          />
        )}
        <Button
          size="sm"
          variant="outline"
          icon="fas fa-rotate-left"
          onClick={onReset}
          title="Reset"
          aria-label="Reset"
          style={{ width: 38, height: 38, borderRadius: '50%', padding: 0 }}
        />
        <Button
          size="sm"
          variant="ghost"
          icon="fas fa-expand"
          onClick={onOpenModal}
          title="Open full timer"
          aria-label="Open full timer"
          style={{ width: 38, height: 38, borderRadius: '50%', padding: 0 }}
        />
      </div>
    </div>
  );
});

VisualTimerWidget.displayName = 'VisualTimerWidget';
