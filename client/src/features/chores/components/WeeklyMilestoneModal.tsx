import React from 'react';
import { Button, PointsBadge } from '../../../components/ui';
import { Person } from '../../../types';

export interface WeeklyMilestoneModalProps {
  isOpen: boolean;
  person: Person | null;
  choreTitle: string;
  bonusPoints: number;
  totalPoints: number;
  isCash?: boolean;
  onClaim: () => void;
}

export const WeeklyMilestoneModal: React.FC<WeeklyMilestoneModalProps> = ({
  isOpen,
  person,
  choreTitle,
  bonusPoints,
  totalPoints,
  isCash = false,
  onClaim,
}) => {
  if (!isOpen || !person) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        zIndex: 10005,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClaim}
    >
      <div
        className="card"
        style={{
          maxWidth: 460,
          width: '100%',
          padding: 32,
          borderRadius: 'var(--modal-radius, 24px)',
          textAlign: 'center',
          background: 'linear-gradient(150deg, #1e293b, #0f172a)',
          border: '2px solid rgba(236, 72, 153, 0.6)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(236, 72, 153, 0.3)',
          animation: 'popIn 0.25s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: '3.6rem', marginBottom: 8, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}>
          🏆🌟🎁
        </div>

        <h2 style={{ margin: '0 0 8px', fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc' }}>
          Weekly Milestone Crushed!
        </h2>

        <p style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5 }}>
          Outstanding commitment! <strong style={{ color: person.color || '#38bdf8' }}>{person.name}</strong> completed{' '}
          <strong style={{ color: '#f8fafc' }}>&ldquo;{choreTitle}&rdquo;</strong> for every single scheduled day this week!
        </p>

        {/* Bonus Points Badge Container */}
        <div
          style={{
            margin: '0 auto 20px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 24px',
            borderRadius: 999,
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(244, 63, 94, 0.25))',
            border: '2px solid rgba(236, 72, 153, 0.7)',
            boxShadow: '0 8px 24px rgba(236, 72, 153, 0.35)',
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>🎁</span>
          <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f43f5e', letterSpacing: '0.5px' }}>
            +{isCash ? `$${bonusPoints.toFixed(2)}` : `${bonusPoints} Bonus Points`}
          </span>
        </div>

        <div style={{ marginBottom: 28, fontSize: '0.9rem', color: '#94a3b8' }}>
          New Balance:{' '}
          <strong style={{ color: '#fbbf24', fontSize: '1.05rem', fontWeight: 800 }}>
            {isCash ? `$${totalPoints.toFixed(2)}` : `${totalPoints} pts`}
          </strong>
        </div>

        {/* Big gamified claim button */}
        <Button
          variant="success"
          size="lg"
          fullWidth
          onClick={onClaim}
          icon="fas fa-sparkles"
          style={{
            fontWeight: 900,
            fontSize: '1.15rem',
            padding: '14px 24px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.45)',
          }}
        >
          🎉 Claim Points!
        </Button>
      </div>
    </div>
  );
};
