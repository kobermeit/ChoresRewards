import React, { memo } from 'react';
import { UserAvatar } from '../../../components/ui';
import { Person, Chore } from '../../../types';

export interface FamilyTasksWidgetProps {
  dateFilter: 'today' | 'tomorrow' | 'week';
  family: Person[];
  chores: Chore[];
  onSelectPerson: (personId: number) => void;
  onOpenChores: () => void;
}

export const FamilyTasksWidget: React.FC<FamilyTasksWidgetProps> = memo(({
  dateFilter,
  family,
  chores,
  onSelectPerson,
  onOpenChores,
}) => {
  const title =
    dateFilter === 'tomorrow'
      ? "Tomorrow's Tasks"
      : dateFilter === 'week'
      ? "This Week's Tasks"
      : "Today's Tasks";

  return (
    <div
      className="dashboard-card"
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}
      onClick={onOpenChores}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-list-check" style={{ color: '#4ade80' }} />
          <span>{title}</span>
        </h3>
        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Chores &rarr;</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
        {family.map((person) => {
          const pChores = chores.filter((c) => c.assigned_to === person.name && !c.deleted);
          const incomplete = pChores.filter((c) => !c.completed);
          const done = pChores.filter((c) => c.completed);

          return (
            <div
              key={person.id}
              className="dash-person-row"
              style={{
                cursor: 'pointer',
                borderRadius: 10,
                padding: '8px 10px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flex: '1 1 0',
                minHeight: 0,
              }}
              title={`View ${person.name}'s chores`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPerson(person.id);
              }}
            >
              <UserAvatar
                avatar={person.avatar}
                name={person.name}
                color={person.accent_color}
                size={38}
                borderWidth={2}
              />
              <div className="dash-person-info" style={{ flex: 1, minWidth: 0 }}>
                <div className="dash-person-name" style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                  {person.name}
                </div>
                <div
                  className="dash-person-chores"
                  style={{
                    fontSize: '0.78rem',
                    color: '#94a3b8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {incomplete.length > 0
                    ? `${incomplete.slice(0, 2).map((c) => c.title).join(', ')}${incomplete.length > 2 ? ` +${incomplete.length - 2} more` : ''}`
                    : done.length > 0
                    ? 'All done today! 🎉'
                    : 'No chores'}
                </div>
              </div>
              <span
                className={`dash-person-badge${
                  done.length > 0 && incomplete.length === 0
                    ? ' dash-all-done'
                    : incomplete.length === 0
                    ? ' dash-free-day'
                    : ''
                }`}
              >
                {incomplete.length > 0 ? (
                  `${incomplete.length} left`
                ) : done.length > 0 ? (
                  <i className="fas fa-check" />
                ) : (
                  'Free'
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

FamilyTasksWidget.displayName = 'FamilyTasksWidget';
