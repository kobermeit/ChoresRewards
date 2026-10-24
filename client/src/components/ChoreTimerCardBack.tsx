import React from 'react';
import { useTimer } from '../context/TimerContext';
import { useApp } from '../context/AppContext';
import { Chore, Person } from '../types';
import { CardShell, TimerRing, Button, IconButton } from './ui';

interface ChoreTimerCardBackProps {
  chore: Chore;
  person?: Person;
  onFlipBack: () => void;
  onComplete: () => void;
}

/**
 * Back face of a timed chore card. Renders inside the shared CardShell with the same body padding,
 * gap and action row as ItemCard, so it automatically matches whatever size the front card has.
 */
export const ChoreTimerCardBack: React.FC<ChoreTimerCardBackProps> = ({
  chore,
  person,
  onFlipBack,
  onComplete,
}) => {
  const { getChoreTimer, startChoreTimer, pauseChoreTimer, resumeChoreTimer, stopChoreTimer } = useTimer();
  const { isParent, activeUser } = useApp();

  const isCompletedForAnother = Boolean(isParent && activeUser && person && person.id !== activeUser.id);

  const timer = getChoreTimer(chore.id);
  const total = timer ? timer.totalSeconds : (chore.duration_seconds || 600);
  const remaining = timer ? timer.remainingSeconds : total;
  const isRunning = timer ? timer.isRunning : false;

  const fraction = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  // >35% calm green, 15-35% amber, <15% red
  const timerColor = fraction > 0.35 ? '#10b981' : fraction > 0.15 ? '#f59e0b' : '#ef4444';

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  const caption = remaining === 0 ? 'Time Up!' : isRunning ? 'Active' : 'Paused';

  return (
    <CardShell borderColor={timerColor} className="cr-chore-timer-card-back">
      <div
        className="cr-item-card-body"
        style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 13, flex: 1, minHeight: 0 }}
      >
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
          <h3
            className="cr-item-card-title"
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 800,
              color: '#f8fafc',
              lineHeight: 1.3,
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={chore.title}
          >
            {chore.title}
          </h3>
          <IconButton
            size="sm"
            variant="ghost"
            icon="fas fa-rotate"
            aria-label="Flip back to chore card"
            title="Flip back to chore card"
            onClick={onFlipBack}
          />
        </div>

        {/* Ring fills all remaining card space */}
        <TimerRing fraction={fraction} color={timerColor} label={timeFormatted} caption={caption} />

        {/* Actions (same row style as the front card) */}
        <div
          className="cr-item-card-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingTop: 8,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            width: '100%',
          }}
        >
          <Button
            size="sm"
            variant="secondary"
            icon={isRunning ? 'fas fa-pause' : 'fas fa-play'}
            title={isRunning ? 'Pause timer' : 'Start/Resume timer'}
            aria-label={isRunning ? 'Pause timer' : 'Start/Resume timer'}
            onClick={() => {
              if (!timer) startChoreTimer(chore);
              else if (isRunning) pauseChoreTimer(chore.id);
              else resumeChoreTimer(chore.id);
            }}
          />
          <Button
            size="sm"
            variant="success"
            icon="fas fa-check"
            fullWidth
            className="btn-complete-chore"
            onClick={() => {
              stopChoreTimer(chore.id);
              onComplete();
            }}
          >
            {isCompletedForAnother ? `Done for ${person?.name}` : 'Done'}
          </Button>
        </div>
      </div>
    </CardShell>
  );
};
