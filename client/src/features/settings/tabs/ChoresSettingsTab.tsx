import React from 'react';
import { useApp } from '../../../context/AppContext';
import { apiPost, resolveAssetUrl } from '../../../api';
import { Button } from '../../../components/ui';

export const ChoresSettingsTab: React.FC = () => {
  const { data, refresh, showToast, confirm, openEditChoreModal } = useApp();

  return (
    <div className="card" style={{ padding: 24, borderRadius: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>🧹 All Household Chores ({data?.chores?.length || 0})</h3>
        <Button
          variant="primary"
          size="sm"
          icon="fas fa-plus"
          onClick={() => openEditChoreModal(null)}
        >
          Add Chore
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data?.chores || []).map((c) => {
          const assignedPerson = (data?.family || []).find((p) => p.name === c.assigned_to);
          const memberColor = assignedPerson?.color || '#3b82f6';
          const rawDays = c.days_of_week ? c.days_of_week.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean) : [];
          let daysText = c.is_daily ? 'Every day' : 'Once-off';
          if (rawDays.length >= 7) {
            daysText = 'Every day';
          } else if (rawDays.length === 5 && ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].every((d) => rawDays.includes(d))) {
            daysText = 'Mon – Fri';
          } else if (rawDays.length === 2 && ['saturday', 'sunday'].every((d) => rawDays.includes(d))) {
            daysText = 'Weekends';
          } else if (rawDays.length > 0) {
            const mapDay: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
            daysText = rawDays.map((d) => mapDay[d] || d.slice(0, 3)).join(', ');
          }

          return (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 'var(--card-radius)',
                background: 'rgba(255,255,255,0.05)',
                borderLeft: `5px solid ${memberColor}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {c.image_url ? (
                  <img
                    src={resolveAssetUrl(c.image_url)}
                    alt={c.title}
                    style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: `${memberColor}22`,
                      border: `1.5px solid ${memberColor}44`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                    }}
                  >
                    {c.icon || '🧹'}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.02rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>{c.title}</span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: `${memberColor}22`,
                        color: memberColor,
                        border: `1px solid ${memberColor}44`,
                      }}
                    >
                      {c.assigned_to}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.08)',
                        color: '#cbd5e1',
                      }}
                    >
                      {daysText}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>
                      {data?.reward_system === 'cash' ? `$${Number(c.points).toFixed(2)}` : `${c.points} pts`}
                    </span>
                    {c.due_datetime && (
                      <span style={{ color: '#f87171' }}>• Due {c.due_datetime}</span>
                    )}
                    {c.completed ? (
                      <span style={{ color: '#4ade80', fontWeight: 700 }}>• Done today</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="fas fa-pencil-alt"
                  onClick={() => openEditChoreModal(c)}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon="fas fa-trash-alt"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete Chore',
                      message: `Are you sure you want to permanently delete "${c.title}"?`,
                      confirmText: 'Delete',
                      danger: true,
                    });
                    if (ok) {
                      await apiPost('delete_chore', { chore_id: c.id, permanent: true });
                      showToast(`Deleted chore "${c.title}"`);
                      await refresh();
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
        {(data?.chores || []).length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', opacity: 0.6 }}>
            No chores found. Tap &quot;Add Chore&quot; to create your first household chore!
          </div>
        )}
      </div>
    </div>
  );
};

export default ChoresSettingsTab;
