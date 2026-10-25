import React, { memo } from 'react';
import { Chore, Person } from '../../../types';
import { ItemCard, Button, IconButton, FlipCard, Badge, PointsBadge } from '../../../components/ui';
import { ChoreTimerCardBack } from '../../../components/ChoreTimerCardBack';
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
  onDelete,
}) => {
  const isDone = Boolean(chore.completed);
  const daysLabel = formatDaysTag(chore.days_of_week, chore.is_daily);
  const memberColor = person.color || '#fbbf24';

  const isTimed = Boolean(chore.duration_seconds && chore.duration_seconds > 0);
  const mins = isTimed ? Math.round((chore.duration_seconds || 0) / 60) : 0;

  const metadataBadges = (
    <>
      <PointsBadge amount={chore.points} isCash={isCash} />
      {isTimed && (
        <Badge variant="info">
          <i className="fas fa-stopwatch" style={{ marginRight: 4 }} />
          {mins}m
        </Badge>
      )}
      {daysLabel && <Badge variant="neutral">{daysLabel}</Badge>}
      {chore.due_datetime && (
        <Badge variant={isOverdue ? 'danger' : 'neutral'}>
          <i className="fas fa-clock" style={{ marginRight: 4 }} />
          {new Date(chore.due_datetime.replace(' ', 'T')).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Badge>
      )}
    </>
  );

  const headerActions = isParent ? (
    <div style={{ display: 'flex', gap: 4 }}>
      <IconButton
        size="sm"
        variant="ghost"
        icon="fas fa-pen"
        title="Edit chore"
        aria-label="Edit chore"
        onClick={() => onEdit(chore)}
      />
      <IconButton
        size="sm"
        variant="ghost"
        icon="fas fa-trash-alt"
        title="Delete chore"
        aria-label="Delete chore"
        style={{ color: '#ef4444' }}
        onClick={() => onDelete(chore)}
      />
    </div>
  ) : null;

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
    <ItemCard
      title={chore.title}
      description={chore.description}
      icon={chore.icon || detectChoreIcon(chore.title)}
      imageUrl={chore.image_url}
      statusBadges={metadataBadges}
      metadata={metadataBadges}
      accentColor={memberColor}
      secondaryActions={headerActions}
      headerAction={headerActions}
      primaryAction={cardActions}
      actions={cardActions}
      isOverdue={isOverdue}
      isCompleted={isDone}
    />
  );

  if (isTimed) {
    return (
      <FlipCard
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

  return <div key={chore.id}>{frontCard}</div>;
});

ChoreCard.displayName = 'ChoreCard';
