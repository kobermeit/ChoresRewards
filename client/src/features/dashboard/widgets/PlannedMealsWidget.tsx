import React, { memo } from 'react';

export interface PlannedMealsWidgetProps {
  dateFilter: 'today' | 'tomorrow' | 'week';
  meals: Array<{ label: string; name: string }>;
  onOpenPlanner: () => void;
}

export const PlannedMealsWidget: React.FC<PlannedMealsWidgetProps> = memo(({
  dateFilter,
  meals,
  onOpenPlanner,
}) => {
  const title =
    dateFilter === 'tomorrow'
      ? 'Meals Tomorrow'
      : dateFilter === 'week'
      ? 'Meals This Week'
      : 'Meals Today';

  return (
    <div
      className="dashboard-card"
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}
      onClick={onOpenPlanner}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-utensils" style={{ color: '#fb923c' }} />
          <span>{title}</span>
        </h3>
        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Planner &rarr;</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {meals.map((m, idx) => (
          <div
            key={idx}
            className="dash-meal-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.04)',
            }}
          >
            <span className="dash-meal-label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#fb923c' }}>
              {m.label}
            </span>
            <span className="dash-meal-name" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {m.name}
            </span>
          </div>
        ))}
        {meals.length === 0 && (
          <p className="dash-empty-hint" style={{ textAlign: 'center', margin: '14px 0' }}>
            No meals planned for {dateFilter === 'tomorrow' ? 'tomorrow' : 'today'} yet.
          </p>
        )}
      </div>
    </div>
  );
});

PlannedMealsWidget.displayName = 'PlannedMealsWidget';
