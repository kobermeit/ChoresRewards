import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { apiGet, apiPost, resolveAssetUrl } from '../../../api';
import { Button } from '../../../components/ui';
import { formatPoints, pointsToCash, scheduleLabel, scheduledDaysPerWeek } from '../choreWeeklyPoints';
import { ChoresPointsSummary } from './ChoresPointsSummary';

/** Human-readable schedule label; tolerates a CSV string or an array (older payloads). */
const daysToText = scheduleLabel;


export const ChoresSettingsTab: React.FC = () => {
  const { data, refresh, showToast, confirm, openEditChoreModal } = useApp();
  // The bootstrap payload only carries chores scheduled for today, so the catalog
  // loads every chore (?all=1) and filters by member on the client.
  const [allChores, setAllChores] = useState<any[] | null>(null);
  const [memberFilter, setMemberFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const loadAllChores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<any>('get_chores?all=1', 8000);
      if (res?.success && Array.isArray(res.chores)) setAllChores(res.chores);
    } catch {
      // fall back to the today-only bootstrap list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllChores();
  }, [loadAllChores]);

  const source: any[] = allChores || data?.chores || [];
  const family: any[] = data?.family || [];
  const filtered = useMemo(
    () => (memberFilter === 'all' ? source : source.filter((c) => c.assigned_to === memberFilter)),
    [source, memberFilter]
  );
  const pointValue = Number(data?.point_value ?? 0.5) || 0;
  const isCash = data?.reward_system === 'cash';

  return (
    <div className="card" style={{ padding: 24, borderRadius: 18 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <h3 style={{ margin: 0 }}>
          🧹 All Household Chores ({filtered.length}
          {memberFilter !== 'all' ? ` of ${source.length}` : ''})
        </h3>
        <Button variant="primary" size="sm" icon="fas fa-plus" onClick={() => openEditChoreModal(null)}>
          Add Chore
        </Button>
      </div>

      {/* Current balance / weekly earning potential per member; tapping a pill also filters the list. */}
      <ChoresPointsSummary
        family={family}
        chores={source}
        rewardSystem={isCash ? 'cash' : 'points'}
        pointValue={pointValue}
        selected={memberFilter}
        onSelect={setMemberFilter}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((c) => {
          const assignedPerson = (data?.family || []).find((p) => p.name === c.assigned_to);
          const memberColor = assignedPerson?.color || '#3b82f6';
          const daysText = daysToText(c.days_of_week, Boolean(c.is_daily));
          // Worth if completed on every scheduled day this week (bonus points excluded).
          const daysPerWeek = scheduledDaysPerWeek(c);
          const weeklyPoints = Math.round(Number(c.points || 0) * daysPerWeek * 100) / 100;

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
                  <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>
                      {data?.reward_system === 'cash' ? `$${Number(c.points).toFixed(2)}` : `${c.points} pts`}
                    </span>
                    <span
                      style={{ fontWeight: 700, color: memberColor }}
                      title={`${daysPerWeek}× per week at ${formatPoints(Number(c.points || 0))}`}
                    >
                      • {formatPoints(weeklyPoints)}/wk
                      {pointValue > 0 ? ` (${pointsToCash(weeklyPoints, pointValue)})` : ''}
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
                      await loadAllChores();
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', opacity: 0.6 }}>
            {loading
              ? 'Loading chores…'
              : memberFilter === 'all'
                ? 'No chores found. Tap "Add Chore" to create your first household chore!'
                : `${memberFilter} has no chores yet.`}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChoresSettingsTab;
