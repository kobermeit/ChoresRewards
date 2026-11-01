import React, { memo } from 'react';
import { Chore, Person } from '../../../types';
import { Button, FlipCard, PointsBadge } from '../../../components/ui';
import { ChoreTimerCardBack } from '../../../components/ChoreTimerCardBack';
import { ChoreCardFace } from './ChoreCardFace';
import { detectChoreIcon, formatDaysTag } from '../choreUtils';

export interface ChoreCardProps {
  chore: Chore;
  person: Person;
  isCash: boolean;
  isParent: boolean;
  isOverdue: boolean;
  completeBtnLabel: string;
  isFlipped: boolean;
  activeTimer?: any;
  onComplete: (chore: Chore, person: Person, meta?: { actual_seconds?: number; target_seconds?: number; timer_status?: string }) => void;
  onUndo: (choreId: number) => void;
  onStartTimer: (chore: Chore) => void;
  onToggleFlip: (choreId: number, flip?: boolean) => void;
  onEdit: (chore: Chore) => void;
  onDelete: (chore: Chore) => void;
  /** Tap on the card body when the user is not a parent (read-only detail modal). */
  onShowDetails: (chore: Chore) => void;
}

export const ChoreCard: React.FC<ChoreCardProps> = memo(({
  chore,
  person,
  isCash,
  isParent,
  isOverdue,
  completeBtnLabel,
  isFlipped,
  activeTimer: _activeTimer,
  onComplete,
  onUndo,
  onStartTimer,
  onToggleFlip,
  onEdit,
  onDelete: _onDelete,
  onShowDetails,
}) => {
  const isDone = Boolean(chore.completed);
  const daysLabel = formatDaysTag(chore.days_of_week, chore.is_daily);
  const memberColor = person.color || '#fbbf24';

  const isTimed = Boolean(chore.duration_seconds && chore.duration_seconds > 0);
  const mins = isTimed ? Math.round((chore.duration_seconds || 0) / 60) : 0;

  const cardActions = isDone ? (
    <Button
      size="sm"
      variant="secondary"
      icon="fas fa-rotate-left"
      fullWidth
      className="btn-undo-chore"
      onClick={() => onUndo(chore.id)}
    >
      Undo
    </Button>
  ) : isTimed ? (
    <div style={{ display: 'flex', gap: 6, width: '100%' }}>
      <Button
        size="sm"
        variant="secondary"
        icon="fas fa-forward"
        style={{ flex: '0 0 auto', padding: '0 12px' }}
        title="Skip countdown and go straight to timer back"
        aria-label="Skip countdown and complete chore directly"
        onClick={() => onToggleFlip(chore.id, true)}
      >
        Skip
      </Button>
      <Button
        size="sm"
        variant="success"
        icon="fas fa-play"
        fullWidth
        className="btn-start-timer"
        onClick={() => {
          onStartTimer(chore);
          onToggleFlip(chore.id, true);
        }}
      >
        Start ({mins}m)
      </Button>
    </div>
  ) : (
    <Button
      size="sm"
      variant="success"
      icon="fas fa-check"
      fullWidth
      className="btn-complete-chore"
      onClick={() => onComplete(chore, person)}
    >
      {completeBtnLabel}
    </Button>
  );

  const frontCard = (
    <ChoreCardFace
      title={chore.title}
      imageUrl={chore.image_url}
      fallbackIcon={chore.icon || detectChoreIcon(chore.title)}
      pointsBadge={<PointsBadge amount={chore.points} isCash={isCash} />}
      minutes={isTimed ? mins : null}
      streak={chore.streak}
      meta={[person.name, daysLabel].filter(Boolean).join(' · ')}
      accentColor={memberColor}
      isDone={isDone}
      isOverdue={isOverdue}
      cta={
        // The CTA keeps its own action; taps must not bubble up and open the modal
        <div className="cr-chore-face__cta" onClick={(e) => e.stopPropagation()}>
          {cardActions}
        </div>
      }
      onOpen={() => (isParent ? onEdit(chore) : onShowDetails(chore))}
    />
  );

  const isRunningTimer = Boolean(_activeTimer?.isRunning);

  if (isTimed) {
    return (
      <FlipCard className={isRunningTimer ? 'cr-keep-solid' : ''}
        key={chore.id}
        isFlipped={isFlipped}
        front={frontCard}
        back={
          <ChoreTimerCardBack
            chore={chore}
            person={person}
            onFlipBack={() => onToggleFlip(chore.id, false)}
            onComplete={(meta) => onComplete(chore, person, meta)}
          />
        }
      />
    );
  }

  return <div key={chore.id} className={isRunningTimer ? 'cr-keep-solid' : ''}>{frontCard}</div>;
});

ChoreCard.displayName = 'ChoreCard';

export default ChoreCard;
