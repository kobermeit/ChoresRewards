import React from 'react';
import { Reward, Person } from '../../../types';
import { resolveAvatarUrl } from '../../../api';
import { Button } from '../../../components/ui';
import { Modal } from '../../../components/common/Modal';

export interface ClaimRewardModalProps {
  reward: Reward | null;
  family: Person[];
  onClose: () => void;
  onConfirmClaim: (reward: Reward, person: Person) => void;
}

export const ClaimRewardModal: React.FC<ClaimRewardModalProps> = ({
  reward,
  family,
  onClose,
  onConfirmClaim,
}) => {
  if (!reward) return null;

  return (
    <Modal
      open={Boolean(reward)}
      onClose={onClose}
      title="Redeem Reward"
      icon="fas fa-gift"
      maxWidth={440}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--cr-text-secondary)' }}>
          Who is redeeming <strong>"{reward.title}"</strong> ({reward.points_required} pts)?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {family.map((person) => {
            const pts = (person.points || 0) + (person.bonus_points || 0);
            const req = Number(reward.points_required || 1);
            const hasEnough = pts >= req;
            return (
              <div
                key={person.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img
                    src={resolveAvatarUrl(person.avatar)}
                    alt={person.name}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                    }}
                    style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{person.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--cr-text-secondary)' }}>
                      {pts} points available
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-redeem-modern"
                  disabled={!hasEnough}
                  onClick={() => onConfirmClaim(reward, person)}
                  style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                >
                  {hasEnough ? `Redeem (-${req})` : `Need ${req - pts} more`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default ClaimRewardModal;
