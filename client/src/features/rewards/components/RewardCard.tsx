import React from 'react';
import { Reward, Person } from '../../../types';
import { resolveAssetUrl, resolveAvatarUrl } from '../../../api';
import { Button, IconButton, PointsBadge, AssigneeBadge } from '../../../components/ui';

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

export interface RewardCardProps {
  reward: Reward;
  family: Person[];
  selectedPerson: Person | null;
  isCash: boolean;
  isParent: boolean;
  onRedeem: (r: Reward) => void;
  onEdit: (r: Reward) => void;
  onDelete: (r: Reward) => void;
  onSyncReward?: (r: Reward) => Promise<void>;
  isSyncing?: boolean;
}

export const RewardCard: React.FC<RewardCardProps> = React.memo(({
  reward,
  family,
  selectedPerson,
  isCash,
  isParent,
  onRedeem,
  onEdit,
  onDelete,
  onSyncReward,
  isSyncing = false,
}) => {
  const isEveryone = reward.assigned_to === 'Everyone' || reward.assigned_to === 'All' || !reward.assigned_to;
  const assignedPerson = !isEveryone ? family.find((p) => p.name === reward.assigned_to) : null;

  const targetPerson = assignedPerson || selectedPerson;
  const currentPts = targetPerson ? (targetPerson.points || 0) + (targetPerson.bonus_points || 0) : 0;
  const reqPts = Number(reward.points_required || 1);
  const rawPercent = reqPts > 0 ? (currentPts / reqPts) * 100 : 0;
  const achievedPercent = Math.min(100, Math.round(rawPercent * 10) / 10);
  const canRedeem = targetPerson ? currentPts >= reqPts : true;

  return (
    <div
      className="reward-card-modern"
      style={{
        background: 'linear-gradient(145deg, #1e293b, #111827)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 18,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Hero Visual Banner */}
      <div
        style={{
          height: 140,
          position: 'relative',
          overflow: 'hidden',
          background: 'radial-gradient(circle at 50% 35%, rgba(59, 130, 246, 0.22) 0%, #0f172a 100%)',
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
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
            <i className={`fas ${getRewardIconClass(reward.title)}`} style={{ fontSize: '3rem', opacity: 0.6 }} />
          </div>
        )}

        {/* Gradient shadow overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.25) 50%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Points Currency Floating Pill */}
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <PointsBadge amount={reqPts} isCash={isCash} />
        </div>

        {/* Assignee Badge in Hero */}
        <div style={{ position: 'absolute', top: 10, left: 10 }}>
          <AssigneeBadge assignee={reward.assigned_to} person={assignedPerson} />
        </div>
      </div>

      {/* Card Body */}
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
            {reward.is_recurring !== false ? (
              <span
                title="Repeatable / recurring reward"
                style={{
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '2px 6px',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                🔁 Recurring
              </span>
            ) : (
              <span
                title="One-time reward"
                style={{
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '2px 6px',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                1-time
              </span>
            )}
          </div>

          {reward.source_url && (
            <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <a
                href={reward.source_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.28)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
                title={`Open product page on ${reward.source_name || 'external site'}`}
              >
                <i className="fas fa-external-link-alt" style={{ fontSize: '0.68rem' }} />
                <span>{reward.source_name || 'View Product'}</span>
              </a>

              {onSyncReward && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isSyncing) onSyncReward(reward);
                  }}
                  disabled={isSyncing}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background:
                      (reward.sync_error_count ?? 0) >= 3
                        ? 'rgba(239, 68, 68, 0.18)'
                        : 'rgba(255, 255, 255, 0.08)',
                    border:
                      (reward.sync_error_count ?? 0) >= 3
                        ? '1px solid rgba(239, 68, 68, 0.45)'
                        : '1px solid rgba(255, 255, 255, 0.12)',
                    color: (reward.sync_error_count ?? 0) >= 3 ? '#f87171' : '#cbd5e1',
                    cursor: isSyncing ? 'wait' : 'pointer',
                    pointerEvents: isSyncing ? 'none' : 'auto',
                    opacity: isSyncing ? 0.7 : 1,
                    fontSize: '0.72rem',
                    transition: 'all 0.15s ease',
                  }}
                  title={
                    isSyncing
                      ? 'Syncing latest price from store...'
                      : (reward.sync_error_count ?? 0) >= 3
                      ? 'Store page has failed to sync 3 times. Click to retry now.'
                      : `Sync latest price & points from ${reward.source_name || 'store'}`
                  }
                  aria-label="Sync latest price from store"
                >
                  <i className={`fas ${isSyncing ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`} />
                </button>
              )}
            </div>
          )}

          {/* Optional description */}
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

          {/* Progress bar */}
          {targetPerson && (
            <div style={{ margin: '8px 0 4px' }}>
              <div className="reward-progress-track" style={{ height: 6, borderRadius: 3 }}>
                <div className="reward-progress-bar" style={{ width: `${achievedPercent}%` }} />
              </div>
              <div className="reward-progress-text" style={{ fontSize: '0.74rem', marginTop: 3 }}>
                <span>{targetPerson.name}: {currentPts} / {reqPts} pts</span>
                <span>{achievedPercent}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions row: Redeem button + Edit / Delete icons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          <Button
            variant={targetPerson && !canRedeem ? 'secondary' : 'success'}
            size="sm"
            icon="fas fa-check"
            onClick={() => onRedeem(reward)}
            disabled={targetPerson ? !canRedeem : false}
            style={{
              flex: 1,
              cursor: targetPerson && !canRedeem ? 'not-allowed' : 'pointer',
            }}
            title={
              targetPerson && !canRedeem
                ? `Not enough points (${currentPts}/${reqPts})`
                : `Redeem "${reward.title}"`
            }
          >
            Redeem
          </Button>

          {isParent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconButton
                size="sm"
                variant="ghost"
                icon="fas fa-pencil-alt"
                aria-label="Edit reward"
                title="Edit reward"
                onClick={() => onEdit(reward)}
              />
              <IconButton
                size="sm"
                variant="danger"
                icon="fas fa-trash-alt"
                aria-label="Delete reward"
                title="Delete reward"
                onClick={() => onDelete(reward)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default RewardCard;
