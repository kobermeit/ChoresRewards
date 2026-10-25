import React, { memo } from 'react';
import { Button, UserAvatar } from '../../../components/ui';
import { Chore, ExtraChore, Person } from '../../../types';
import { ChoreCard } from './ChoreCard';

export interface ChoreKanbanColumnProps {
  person: Person;
  chores: Chore[];
  hideCompleted: boolean;
  overdueIds: Set<number>;
  isCash: boolean;
  isParent: boolean;
  completeBtnLabel: string;
  flippedChores: Record<number, boolean>;
  availableExtraChores: ExtraChore[];
  onOpenProfile: (person: Person) => void;
  onSelectPerson: (personId: number) => void;
  onEditName: (person: Person) => void;
  onPickExtra: (person: Person) => void;
  onAddChore: (personId: number) => void;
  onCompleteChore: (chore: Chore, person: Person, meta?: { actual_seconds?: number; target_seconds?: number; timer_status?: string }) => void;
  onUndoChore: (choreId: number) => void;
  onStartTimer: (chore: Chore) => void;
  onToggleFlip: (choreId: number, flip?: boolean) => void;
  onEditChore: (chore: Chore) => void;
  onDeleteChore: (chore: Chore) => void;
  onDropColumn: (person: Person) => void;
}

export const ChoreKanbanColumn: React.FC<ChoreKanbanColumnProps> = memo(({
  person,
  chores,
  hideCompleted,
  overdueIds,
  isCash,
  isParent,
  completeBtnLabel,
  flippedChores,
  availableExtraChores,
  onOpenProfile,
  onSelectPerson,
  onEditName,
  onPickExtra,
  onAddChore,
  onCompleteChore,
  onUndoChore,
  onStartTimer,
  onToggleFlip,
  onEditChore,
  onDeleteChore,
  onDropColumn,
}) => {
  const pendingChores = chores.filter((c) => !c.completed);
  const completedChores = chores.filter((c) => c.completed);
  const totalToday = pendingChores.length + completedChores.length;
  const doneToday = completedChores.length;
  const remaining = pendingChores.length;
  const pct = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;
  const totalPts = Number((person.points || 0) + (person.bonus_points || 0));
  const streakCount = person.streak?.current_streak || 0;
  const visibleChores = hideCompleted ? pendingChores : [...pendingChores, ...completedChores];

  return (
    <div
      className="column"
      data-person={person.name}
      data-person-id={person.id}
      data-person-age={person.age ?? ''}
      style={{
        background: 'rgba(30, 41, 59, 0.7)',
        border: `1.5px solid ${person.color ? person.color + '44' : 'rgba(255, 255, 255, 0.08)'}`,
        borderTop: `4px solid ${person.color || 'var(--color-primary)'}`,
        borderRadius: 'var(--card-radius, 16px)',
        boxShadow: `0 4px 20px rgba(0, 0, 0, 0.25), 0 0 20px ${person.color ? person.color + '15' : 'transparent'}`,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDropColumn(person)}
    >
      {/* Sleek Compact Column Header */}
      <div
        className="chore-column-header-compact"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: 'rgba(0, 0, 0, 0.22)',
          borderRadius: 12,
          marginBottom: 8,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <UserAvatar
            avatar={person.avatar}
            name={person.name}
            color={person.color}
            size={40}
            borderWidth={2.5}
            onClick={() => onOpenProfile(person)}
            title={`View ${person.name}'s badges`}
            className="avatar-tappable"
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                className="person-name"
                style={{
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => onSelectPerson(person.id)}
                title={`Tap to open ${person.name}'s full-screen chore grid`}
              >
                {person.name}
              </span>
              <i
                className="fas fa-pencil-alt edit-name-icon admin-only"
                style={{
                  fontSize: '0.65rem',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  opacity: 0.7,
                }}
                title="Edit Name"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditName(person);
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              {streakCount > 0 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: '#fbbf24',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  title={`${streakCount} day streak!`}
                >
                  🔥 {streakCount}d
                </span>
              )}
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {doneToday}/{totalToday} done ({pct}%)
              </span>
            </div>
          </div>
        </div>

        {/* Column Right Points Badge & Extra Chores Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: `1.5px solid ${person.color ? person.color + '66' : 'rgba(255,255,255,0.2)'}`,
              padding: '4px 10px',
              borderRadius: 10,
              fontWeight: 900,
              fontSize: '0.92rem',
              color: person.color || '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {isCash ? (
              <>
                <i className="fas fa-money-bill-wave" style={{ color: '#4ade80' }} />
                <span>${totalPts.toFixed(2)}</span>
              </>
            ) : (
              <>
                <i className="fas fa-award" style={{ color: person.color || '#fbbf24' }} />
                <span>{totalPts.toFixed(1)}</span>
              </>
            )}
          </div>

          {availableExtraChores.length > 0 && (
            <Button
              size="sm"
              variant="success"
              icon="fas fa-plus-circle"
              onClick={() => onPickExtra(person)}
              style={{ fontSize: '0.75rem', height: 28, padding: '0 8px', fontWeight: 800 }}
              title="Pick an extra job"
            >
              Extra
            </Button>
          )}
        </div>
      </div>

      {/* Chores Stream in Column */}
      {visibleChores.length > 0 ? (
        <div className="chores-list" style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          {visibleChores.map((chore) => (
            <ChoreCard
              key={chore.id}
              chore={chore}
              person={person}
              isCash={isCash}
              isParent={isParent}
              isOverdue={!chore.completed && (overdueIds.has(chore.id) || Boolean(chore.is_overdue))}
              completeBtnLabel={completeBtnLabel}
              isFlipped={Boolean(flippedChores[chore.id])}
              onComplete={onCompleteChore}
              onUndo={onUndoChore}
              onStartTimer={onStartTimer}
              onToggleFlip={onToggleFlip}
              onEdit={onEditChore}
              onDelete={onDeleteChore}
            />
          ))}
        </div>
      ) : totalToday > 0 && doneToday === totalToday ? (
        <div className="all-done-banner">
          <div className="all-done-emoji">🎉</div>
          <div className="all-done-text">ALL DONE!</div>
          <div className="all-done-subtext">Amazing work today!</div>
        </div>
      ) : (
        <div className="no-chores-banner">
          <div className="no-chores-emoji">😊</div>
          <div className="no-chores-text">FREE DAY!</div>
          <div className="no-chores-subtext">No chores today</div>
        </div>
      )}

      {/* Earn More Prompt when no pending chores and extra chores exist */}
      {pendingChores.length === 0 && availableExtraChores.length > 0 && (
        <div className="earn-more-prompt" id={`earn-more-${person.id}`}>
          <p className="earn-more-prompt-kicker">Want to earn more?</p>
          <button
            type="button"
            className="earn-more-btn"
            onClick={() => onPickExtra(person)}
          >
            <i className="fas fa-plus-circle" /> Pick an extra job
          </button>
        </div>
      )}

      {/* + Add Chore tile */}
      {isParent && (
        <button
          type="button"
          className="chore-kanban-add-btn"
          onClick={() => onAddChore(person.id)}
        >
          <i className="fas fa-plus" /> Add Chore
        </button>
      )}
    </div>
  );
});

ChoreKanbanColumn.displayName = 'ChoreKanbanColumn';
