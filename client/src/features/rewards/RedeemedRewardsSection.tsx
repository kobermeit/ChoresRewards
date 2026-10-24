import React from 'react';
import { useApp } from '../../context/AppContext';
import { Reward } from '../../types';
import { apiPost, resolveAssetUrl, resolveAvatarUrl } from '../../api';
import { PageContainer, Button, IconButton } from '../../components/ui';

function getRewardIconClass(title: string): string {
  const lower = (title || '').toLowerCase();
  if (lower.includes('screen') || lower.includes('ipad') || lower.includes('game') || lower.includes('tv') || lower.includes('switch') || lower.includes('roblox') || lower.includes('minecraft')) return 'fa-gamepad';
  if (lower.includes('ice cream') || lower.includes('treat') || lower.includes('dessert') || lower.includes('candy') || lower.includes('snack') || lower.includes('chocolate')) return 'fa-ice-cream';
  if (lower.includes('park') || lower.includes('playground') || lower.includes('outing') || lower.includes('zoo') || lower.includes('beach') || lower.includes('movie')) return 'fa-tree';
  if (lower.includes('toy') || lower.includes('lego') || lower.includes('card') || lower.includes('pokemon')) return 'fa-gift';
  if (lower.includes('sleepover') || lower.includes('late') || lower.includes('bedtime')) return 'fa-moon';
  if (lower.includes('book') || lower.includes('comic') || lower.includes('read')) return 'fa-book-open';
  if (lower.includes('pizza') || lower.includes('burger') || lower.includes('dinner') || lower.includes('takeaway') || lower.includes('mcdonald')) return 'fa-pizza-slice';
  if (lower.includes('money') || lower.includes('cash') || lower.includes('dollar') || lower.includes('$')) return 'fa-coins';
  return 'fa-star';
}

const FallbackImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  fallbackIcon: string;
}> = ({ src, alt, className, style, fallbackIcon }) => {
  const [hasError, setHasError] = React.useState(false);
  if (hasError) {
    return (
      <div
        className={className}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        <i className={`fas ${fallbackIcon}`} style={{ fontSize: '3rem', opacity: 0.6 }} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setHasError(true)}
    />
  );
};

export interface RedeemedRewardsSectionProps {
  isStandalonePage?: boolean;
}

export const RedeemedRewardsSection: React.FC<RedeemedRewardsSectionProps> = ({ isStandalonePage = false }) => {
  const { data, refresh, showToast, confirm, isParent } = useApp();

  if (!data) return null;
  const family = data.family || [];
  const rewards = data.rewards || [];
  const redeemedRewards = rewards.filter((r) => r.completed);
  const isCash = data.reward_system === 'cash';

  const handleDeleteReward = async (reward: Reward) => {
    const ok = await confirm({
      title: 'Delete from History?',
      message: `Are you sure you want to delete "${reward.title}" from redemption history?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiPost('delete_reward', { reward_id: reward.id });
      showToast(`Deleted reward "${reward.title}"`);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete reward', { type: 'error' });
    }
  };

  return (
    <PageContainer
      title="Redeemed Rewards"
      icon="fas fa-medal"
      iconClass="section-icon-rewards"
      badge={redeemedRewards.length}
      boxed={!isStandalonePage}
    >
      {redeemedRewards.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--cr-text-secondary)', fontStyle: 'italic', marginTop: 14 }}>
          This is where your redeemed rewards will be when you redeem them
        </p>
      )}

      <div className="rewards-grid-modern" style={{ marginTop: 14 }}>
        {redeemedRewards.map((reward) => {
          const person = family.find((p) => p.name === reward.assigned_to);
          const reqPts = Number(reward.points_required || 0);
          const isEveryone = !reward.assigned_to || reward.assigned_to.toLowerCase() === 'everyone';
          return (
            <div
              key={reward.id}
              className="reward-card-modern"
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: 'var(--card-radius, 16px)',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1.5px solid rgba(34, 197, 94, 0.35)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: 140,
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'radial-gradient(circle at 50% 35%, rgba(34, 197, 94, 0.22) 0%, #0f172a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {reward.image_url ? (
                  <FallbackImage
                    src={resolveAssetUrl(reward.image_url)}
                    alt={reward.title}
                    className="reward-hero-img"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: 0.9,
                    }}
                    fallbackIcon={getRewardIconClass(reward.title)}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
                      color: 'rgba(255,255,255,0.4)',
                    }}
                  >
                    <i className={`fas ${getRewardIconClass(reward.title)}`} style={{ fontSize: '3rem', opacity: 0.6, color: '#86efac' }} />
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.25) 50%, transparent 100%)',
                    pointerEvents: 'none',
                  }}
                />

                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    background: 'rgba(22, 163, 74, 0.92)',
                    backdropFilter: 'blur(8px)',
                    border: '1.5px solid #86efac',
                    color: '#ffffff',
                    padding: '4px 10px',
                    borderRadius: 10,
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  }}
                  title="Reward has been redeemed"
                >
                  <i className="fas fa-check-circle" />
                  <span>Redeemed</span>
                </div>

                <div style={{ position: 'absolute', top: 10, left: 10 }}>
                  {isEveryone ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 8,
                        background: 'rgba(168, 85, 247, 0.85)',
                        backdropFilter: 'blur(6px)',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      }}
                    >
                      🌟 Everyone
                    </span>
                  ) : (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(6px)',
                        padding: '3px 8px',
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.2)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      }}
                    >
                      <img
                        src={resolveAvatarUrl(person?.avatar)}
                        alt={reward.assigned_to}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                        }}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                      <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.78rem' }}>
                        {reward.assigned_to}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        color: '#f8fafc',
                        lineHeight: 1.3,
                      }}
                      title={reward.title}
                    >
                      {reward.title}
                    </h3>

                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        color: '#4ade80',
                        background: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        padding: '2px 8px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isCash ? `$${reqPts.toFixed(2)}` : `⭐ ${reqPts} pts`}
                    </span>
                  </div>

                  {reward.description && (
                    <p
                      style={{
                        margin: '4px 0 8px',
                        fontSize: '0.82rem',
                        color: 'rgba(255,255,255,0.65)',
                        lineHeight: 1.4,
                      }}
                      title={reward.description}
                    >
                      {reward.description}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    {reward.date_completed ? `Redeemed ${reward.date_completed}` : 'Completed'}
                  </div>

                  {isParent && (
                    <IconButton
                      size="sm"
                      variant="danger"
                      icon="fas fa-trash-alt"
                      aria-label="Delete from history"
                      title="Delete from redemption history"
                      onClick={() => handleDeleteReward(reward)}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
};

export default RedeemedRewardsSection;
