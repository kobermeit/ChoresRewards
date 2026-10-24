import React, { memo } from 'react';
import { resolveAssetUrl } from '../../../api';
import { Reward } from '../../../types';
import { SeasonalCardWatermark } from '../SeasonalCardWatermark';

export interface TopRewardsWidgetProps {
  rewards: Reward[];
  formatRewardValue: (pts: number | string) => string;
  onOpenRewards: () => void;
}

export const TopRewardsWidget: React.FC<TopRewardsWidgetProps> = memo(({
  rewards,
  formatRewardValue,
  onOpenRewards,
}) => {
  return (
    <div
      className="dashboard-card"
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden' }}
      onClick={onOpenRewards}
    >
      <SeasonalCardWatermark variant={5} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-trophy" style={{ color: '#a78bfa' }} />
          <span>Top Rewards</span>
        </h3>
        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Rewards &rarr;</span>
      </div>

      {rewards.length === 0 ? (
        <p className="dash-empty-hint" style={{ textAlign: 'center', margin: '14px 0' }}>
          No rewards yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rewards.map((r) => (
            <div
              key={r.id}
              className="dash-reward-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.04)',
              }}
            >
              {r.image_url ? (
                <img
                  className="dash-reward-thumb"
                  src={resolveAssetUrl(r.image_url)}
                  alt=""
                  style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }}
                />
              ) : (
                <span
                  className="dash-reward-thumb"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: 'rgba(167, 139, 250, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <i className="fas fa-gift" style={{ color: '#a78bfa', fontSize: '0.85rem' }} />
                </span>
              )}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.title}
              </span>
              <span className="dash-reward-points" style={{ fontWeight: 800, color: '#facc15', fontSize: '0.85rem' }}>
                {formatRewardValue(r.points_required)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

TopRewardsWidget.displayName = 'TopRewardsWidget';
