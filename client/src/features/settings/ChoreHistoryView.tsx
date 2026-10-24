import React, { useState, useEffect } from 'react';
import { useNavigation } from '../../hooks/useSettings';
import { apiGet, resolveAvatarUrl } from '../../api';
import { Button, WipBanner } from '../../components/ui';

export const ChoreHistoryView: React.FC = () => {
  const { navigate: setActiveView } = useNavigation();
  const [historyData, setHistoryData] = useState<any>(null);

  useEffect(() => {
    apiGet<any>('chore_history_data?days=30')
      .then((res) => {
        if (res?.success) setHistoryData(res);
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>📊 Chore History & Stats (Last 30 Days)</h2>
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

      {historyData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
          {(historyData.leaderboard || []).map((p: any) => (
            <div key={p.id} className="card" style={{ padding: 18, borderRadius: 16, textAlign: 'center' }}>
              <img
                src={resolveAvatarUrl(p.avatar)}
                alt={p.name}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                }}
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }}
              />
              <h3 style={{ margin: 0 }}>{p.name}</h3>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#4ade80', marginTop: 4 }}>
                {p.completed_count} chores
              </div>
              <div style={{ fontSize: '0.82rem', opacity: 0.75 }}>
                🔥 Current Streak: {p.current_streak}d (Best: {p.longest_streak}d)
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChoreHistoryView;
