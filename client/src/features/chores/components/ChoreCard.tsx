import React, { memo } from 'react';
import { Button, IconButton, ItemCard, FlipCard } from '../../../components/ui';
import { Chore, Person } from '../../../types';
import { ChoreTimerCardBack } from '../../../components/ChoreTimerCardBack';
import { detectChoreIcon, formatDaysTag, formatPoints } from '../choreUtils';

export interface ChoreCardProps {
  chore: Chore;
  person: Person;
  isCash: boolean;
  isParent: boolean;
  isOverdue: boolean;
  completeBtnLabel: string;
  isFlipped: boolean;
  activeTimer?: any;
  onComplete: (chore: Chore, person: Person) => void;
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

  const pointsPill = (
    <div
      style={{
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        border: `1.5px solid ${isCash ? '#4ade80' : memberColor}`,
        color: isCash ? '#4ade80' : memberColor,
        padding: '3px 8px',
        borderRadius: 8,
        fontWeight: 900,
        fontSize: '0.86rem',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        boxShadow: `0 3px 10px rgba(0,0,0,0.5), 0 0 10px ${memberColor}33`,
      }}
      title="Points reward"
    >
      {isCash ? (
        <>
          <i className="fas fa-money-bill-wave" style={{ color: '#4ade80', fontSize: '0.82rem' }} />
          <span>${Number(chore.points).toFixed(2)}</span>
        </>
      ) : (
        <>
          <i className="fas fa-star" style={{ color: memberColor, fontSize: '0.82rem' }} />
          <span>{formatPoints(chore.points)} pts</span>
        </>
      )}
    </div>
  );

  const statusBadges = isDone ? (
    <span
      style={{
        background: 'rgba(16, 185, 129, 0.2)',
        border: '1px solid rgba(16, 185, 129, 0.45)',
        color: '#6ee7b7',
        fontWeight: 800,
        fontSize: '0.72rem',
        padding: '2px 8px',
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <i className="fas fa-check" /> Done
    </span>
  ) : (
    <>
      {isOverdue ? (
        <span
          style={{
            background: 'rgba(239, 68, 68, 0.9)',
            backdropFilter: 'blur(6px)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.72rem',
            padding: '2px 7px',
            borderRadius: 6,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}
        >
          🚨 Overdue
        </span>
      ) : daysLabel ? (
        <span
          style={{
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#cbd5e1',
            fontWeight: 700,
            fontSize: '0.72rem',
            padding: '2px 7px',
            borderRadius: 6,
          }}
        >
          {daysLabel}
        </span>
      ) : chore.is_extra ? (
        <span
          style={{
            background: 'rgba(52, 211, 153, 0.85)',
            color: '#064e3b',
            fontWeight: 800,
            fontSize: '0.72rem',
            padding: '2px 7px',
            borderRadius: 6,
          }}
        >
          ⭐ Extra
        </span>
      ) : null}
    </>
  );

  const subtitleNode = chore.due_datetime ? (
    <span
      className={`chore-tag ${isOverdue ? 'chore-tag-overdue' : 'chore-tag-due'}`}
      style={{ fontSize: '0.72rem' }}
    >
      <i className="fas fa-clock" /> {isOverdue ? 'Overdue' : `Due ${chore.due_datetime}`}
    </span>
  ) : null;

  const isTimed = !isDone && Boolean(chore.duration_seconds && chore.duration_seconds > 0);

  const primaryAction = isDone ? (
    <Button
      size="sm"
      variant="secondary"
      icon="fas fa-rotate-left"
      fullWidth
      onClick={() => onUndo(chore.id)}
      title="Undo completion (takes back points)"
      aria-label="Undo completion"
    />
  ) : isTimed ? (
    <div style={{ display: 'flex', gap: 6, width: '100%', alignItems: 'center' }}>
      <Button
        size="sm"
        variant="secondary"
        icon="fas fa-forward"
        style={{ flex: '0 0 auto', padding: '0 10px', fontSize: '0.8rem' }}
        onClick={() => onToggleFlip(chore.id, true)}
        title="Skip countdown and go straight to completion card"
      >
        Skip
      </Button>
      <Button
        size="sm"
        variant="success"
        icon="fas fa-play"
        style={{ flex: '1 1 auto' }}
        onClick={() => {
          onStartTimer(chore);
          onToggleFlip(chore.id, true);
        }}
      >
        Start ({Math.round((chore.duration_seconds || 600) / 60)}m)
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

  const secondaryActions = isParent ? (
    <div style={{ display: 'flex', gap: 4 }}>
      <IconButton
        size="sm"
        variant="ghost"
        icon="fas fa-pencil-alt"
        aria-label="Edit chore"
        title="Edit chore"
        onClick={() => onEdit(chore)}
      />
      <IconButton
        size="sm"
        variant="danger"
        icon="fas fa-trash-alt"
        aria-label="Delete chore"
        title="Delete chore"
        onClick={() => onDelete(chore)}
      />
    </div>
  ) : null;

  const frontCard = (
    <ItemCard
      title={chore.title}
      subtitle={subtitleNode}
      description={chore.description}
      imageUrl={chore.image_url}
      icon={detectChoreIcon(chore.title, chore.icon)}
      accentColor={person.color}
      heroHeight={140}
      pointsBadge={pointsPill}
      statusBadges={statusBadges}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
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
            onFlipBack={() => onToggleFlip(chore.id, false)}
            onComplete={() => onComplete(chore, person)}
          />
        }
      />
    );
  }

  return <div key={chore.id}>{frontCard}</div>;
});

ChoreCard.displayName = 'ChoreCard';
