import React, { useState, useEffect } from 'react';
import { Modal } from './common/Modal';
import { Button } from './ui';
import { Person } from '../types';
import { apiGet, resolveAvatarUrl } from '../api';

export interface PointsHistoryModalProps {
  open: boolean;
  onClose: () => void;
  person: Person | null;
  isCash?: boolean;
}

export const PointsHistoryModal: React.FC<PointsHistoryModalProps> = ({
  open,
  onClose,
  person,
  isCash = false,
}) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !person) return;
    setLoading(true);
    apiGet<any>(`activity_log?user=${encodeURIComponent(person.name)}`)
      .then((res) => {
        const list = Array.isArray(res?.logs) ? res.logs : Array.isArray(res) ? res : [];
        setLogs(list);
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [open, person]);

  if (!person) return null;

  const totalPoints = (person.points || 0) + (person.bonus_points || 0);

  const getLogBadge = (log: any) => {
    const text = String(log.description || '');
    const type = String(log.type || log.action_type || '').toLowerCase();

    // Check for point values in description like "(+10 pts)", "(5 pts)", "(-20 pts)"
    const match = text.match(/([+-]?\d+(?:\.\d+)?)\s*(?:pts|points|\$)/i);
    if (match) {
      const val = parseFloat(match[1]);
      if (type.includes('redeem') || type.includes('deduct') || text.includes('deducted') || text.includes('redeemed')) {
        return { label: `-${Math.abs(val)}`, isPositive: false };
      }
      return { label: `+${Math.abs(val)}`, isPositive: true };
    }

    if (type.includes('chore_completed') || type.includes('bonus')) {
      return { label: '+pts', isPositive: true };
    }
    if (type.includes('redeem') || type.includes('deduct')) {
      return { label: '-pts', isPositive: false };
    }
    return null;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${person.name}'s Points History`}
      icon="fas fa-coins"
      maxWidth={520}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Person Summary Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${person.color || '#3b82f6'}40`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {person.avatar && person.avatar !== 'default_avatar.png' ? (
              <img
                src={resolveAvatarUrl(person.avatar)}
                alt=""
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  objectFit: 'cover',
                  border: `2px solid ${person.color || '#3b82f6'}`,
                }}
              />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: person.color || '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  color: '#fff',
                }}
              >
                {person.name.slice(0, 2)}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#f8fafc' }}>
                {person.name}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                {person.role === 'parent' ? 'Parent' : 'Family Member'}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#38bdf8' }}>
              {isCash ? `$${totalPoints.toFixed(2)}` : `${totalPoints} pts`}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Current Balance
            </div>
          </div>
        </div>

        {/* History List */}
        <div
          style={{
            maxHeight: 340,
            overflowY: 'auto',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
              <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} /> Loading activity...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
              No points activity recorded yet for {person.name}.
            </div>
          ) : (
            logs.map((l) => {
              const badge = getLogBadge(l);
              const dateStr = l.date || l.timestamp;
              let formattedDate = '';
              if (dateStr) {
                try {
                  const d = new Date(String(dateStr).replace(' ', 'T'));
                  formattedDate = d.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  });
                } catch {
                  formattedDate = String(dateStr);
                }
              }

              return (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        color: '#f8fafc',
                        lineHeight: 1.35,
                      }}
                    >
                      {l.description}
                    </div>
                    {formattedDate && (
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                        {formattedDate}
                      </div>
                    )}
                  </div>

                  {badge && (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        background: badge.isPositive ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${badge.isPositive ? 'rgba(52, 211, 153, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                        color: badge.isPositive ? '#34d399' : '#f87171',
                        flexShrink: 0,
                      }}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
