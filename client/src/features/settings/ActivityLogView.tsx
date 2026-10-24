import React, { useState, useEffect } from 'react';
import { useNavigation } from '../../hooks/useSettings';
import { apiGet } from '../../api';
import { Button, Select, WipBanner } from '../../components/ui';

export const ActivityLogView: React.FC = () => {
  const { navigate: setActiveView } = useNavigation();
  const [logs, setLogs] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    const q = filterType ? `activity_log_data?action_type=${encodeURIComponent(filterType)}` : 'activity_log_data';
    apiGet<any>(q)
      .then((res) => {
        if (res?.logs) setLogs(res.logs);
      })
      .catch(() => {});
  }, [filterType]);

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>📜 Activity & Point Log</h2>
        <Button
          type="button"
          onClick={() => setActiveView('dashboard')}
          variant="primary"
          size="sm"
          icon="fas fa-arrow-left"
        >
          Back to Dashboard
        </Button>
      </div>
      <WipBanner />

      <div className="card" style={{ padding: 20, borderRadius: 16 }}>
        <div style={{ marginBottom: 14, maxWidth: 300 }}>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Activity Types</option>
            <option value="chore_completed">Chore Completed</option>
            <option value="reward_redeemed">Reward Redeemed</option>
            <option value="bonus_points">Bonus Points</option>
            <option value="badge_earned">Badge Earned</option>
          </Select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map((l) => (
            <div
              key={l.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{l.description}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.65 }}>{l.action_type}</div>
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                {new Date(l.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogView;
