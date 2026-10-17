import React, { useState } from 'react';
import { apiPost } from '../api';
import { useApp } from '../context/AppContext';

interface MemberDraft {
  name: string;
  color: string;
  age: string;
  is_admin: boolean;
  pin: string;
}

const DEFAULT_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export const SetupWizard: React.FC = () => {
  const { refresh, showToast } = useApp();
  const [members, setMembers] = useState<MemberDraft[]>([
    { name: '', color: '#3b82f6', age: '', is_admin: true, pin: '' },
    { name: '', color: '#ec4899', age: '7', is_admin: false, pin: '' },
  ]);
  const [rewardSystem, setRewardSystem] = useState<'points' | 'cash'>('points');
  const [bonusMode, setBonusMode] = useState<'static' | 'range' | 'none'>('static');
  const [bonusStatic, setBonusStatic] = useState('10');
  const [bonusMin, setBonusMin] = useState('2');
  const [bonusMax, setBonusMax] = useState('8');
  const [bonusOncePerDay, setBonusOncePerDay] = useState(true);
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Adelaide';
    } catch {
      return 'Australia/Adelaide';
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addMemberRow = () => {
    setMembers((prev) => [
      ...prev,
      {
        name: '',
        color: DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length],
        age: '',
        is_admin: false,
        pin: '',
      },
    ]);
  };

  const removeMemberRow = (idx: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateMember = (idx: number, patch: Partial<MemberDraft>) => {
    setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = members
      .map((m) => ({
        name: m.name.trim(),
        color: m.color,
        age: m.age ? parseInt(m.age, 10) : null,
        is_admin: m.is_admin,
        pin: m.pin.trim(),
      }))
      .filter((m) => m.name.length > 0);

    if (cleaned.length === 0) {
      setError('Please add at least one family member.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost('setup', {
        people: cleaned,
        reward_system: rewardSystem,
        bonus_mode: bonusMode,
        bonus_static: bonusStatic,
        bonus_min: bonusMin,
        bonus_max: bonusMax,
        bonus_once_per_day: bonusOncePerDay,
        timezone,
      });

      if (!res?.success) {
        setError(res?.error || (res?.errors && res.errors[0]) || 'Failed to complete setup.');
      } else {
        showToast('Welcome to Chores & Rewards! 🎉');
        await refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Error saving setup');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 820, margin: '36px auto', padding: '0 20px' }}>
      <div
        style={{
          background: 'var(--cr-surface-1)',
          border: '1px solid var(--cr-surface-border)',
          borderRadius: 20,
          padding: 32,
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <img src="./static/images/mascot-transp.png" alt="Mascot" style={{ width: 72, height: 72 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--cr-text-primary)' }}>
              Welcome to Chores & Rewards
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--cr-text-secondary)' }}>
              Set up your family members, adult PIN, and reward preferences to get started.
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.16)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '12px 16px',
              borderRadius: 12,
              marginBottom: 20,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Family Members */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: 'var(--cr-text-primary)' }}>1. Family Members</h3>
              <button
                type="button"
                onClick={addMemberRow}
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                + Add Person
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {members.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    alignItems: 'center',
                    background: 'var(--cr-surface-2)',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid var(--cr-surface-border)',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Name (e.g. Kurt, Sarah)"
                    value={m.name}
                    onChange={(e) => updateMember(idx, { name: e.target.value })}
                    style={{
                      flex: '1 1 160px',
                      minWidth: 140,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--cr-surface-border)',
                      background: 'var(--cr-surface-1)',
                      color: 'var(--cr-text-primary)',
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Age"
                    min={1}
                    max={99}
                    value={m.age}
                    onChange={(e) => updateMember(idx, { age: e.target.value })}
                    style={{
                      width: 80,
                      padding: '10px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--cr-surface-border)',
                      background: 'var(--cr-surface-1)',
                      color: 'var(--cr-text-primary)',
                    }}
                  />
                  <input
                    type="color"
                    value={m.color}
                    onChange={(e) => updateMember(idx, { color: e.target.value })}
                    style={{ width: 44, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--cr-text-primary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      margin: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={m.is_admin}
                      onChange={(e) => updateMember(idx, { is_admin: e.target.checked })}
                    />
                    Adult / Admin
                  </label>
                  {m.is_admin && (
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="4-digit PIN"
                      value={m.pin}
                      onChange={(e) => updateMember(idx, { pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      style={{
                        width: 115,
                        padding: '10px',
                        borderRadius: 8,
                        border: '1px solid #3b82f6',
                        background: 'var(--cr-surface-1)',
                        color: 'var(--cr-text-primary)',
                        textAlign: 'center',
                        letterSpacing: 3,
                        fontWeight: 700,
                      }}
                    />
                  )}
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMemberRow(idx)}
                      style={{
                        background: 'rgba(239,68,68,0.2)',
                        color: '#f87171',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 10px',
                        cursor: 'pointer',
                        marginLeft: 'auto',
                      }}
                    >
                      <i className="fas fa-trash" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reward System & Timezone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div
              style={{
                background: 'var(--cr-surface-2)',
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--cr-surface-border)',
              }}
            >
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 8, color: 'var(--cr-text-primary)' }}>
                2. Reward System
              </label>
              <select
                value={rewardSystem}
                onChange={(e) => setRewardSystem(e.target.value as 'points' | 'cash')}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--cr-surface-1)',
                  color: 'var(--cr-text-primary)',
                  border: '1px solid var(--cr-surface-border)',
                }}
              >
                <option value="points">Points (⭐ e.g. 10 pts)</option>
                <option value="cash">Cash / Pocket Money (💵 e.g. $2.50)</option>
              </select>
            </div>

            <div
              style={{
                background: 'var(--cr-surface-2)',
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--cr-surface-border)',
              }}
            >
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 8, color: 'var(--cr-text-primary)' }}>
                3. Household Timezone
              </label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Australia/Adelaide"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--cr-surface-1)',
                  color: 'var(--cr-text-primary)',
                  border: '1px solid var(--cr-surface-border)',
                }}
              />
            </div>
          </div>

          {/* Bonus Points */}
          <div
            style={{
              background: 'var(--cr-surface-2)',
              padding: 16,
              borderRadius: 12,
              border: '1px solid var(--cr-surface-border)',
            }}
          >
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 8, color: 'var(--cr-text-primary)' }}>
              4. Daily All-Done Bonus Mode
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <select
                value={bonusMode}
                onChange={(e) => setBonusMode(e.target.value as any)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--cr-surface-1)',
                  color: 'var(--cr-text-primary)',
                  border: '1px solid var(--cr-surface-border)',
                }}
              >
                <option value="static">Fixed Bonus Amount</option>
                <option value="range">Random Slot Machine Range</option>
                <option value="none">No Bonus Points</option>
              </select>

              {bonusMode === 'static' && (
                <input
                  type="number"
                  value={bonusStatic}
                  onChange={(e) => setBonusStatic(e.target.value)}
                  style={{ width: 90, padding: '10px', borderRadius: 8, background: 'var(--cr-surface-1)', color: 'var(--cr-text-primary)' }}
                />
              )}
              {bonusMode === 'range' && (
                <>
                  <input
                    type="number"
                    value={bonusMin}
                    onChange={(e) => setBonusMin(e.target.value)}
                    placeholder="Min"
                    style={{ width: 80, padding: '10px', borderRadius: 8, background: 'var(--cr-surface-1)', color: 'var(--cr-text-primary)' }}
                  />
                  <span>to</span>
                  <input
                    type="number"
                    value={bonusMax}
                    onChange={(e) => setBonusMax(e.target.value)}
                    placeholder="Max"
                    style={{ width: 80, padding: '10px', borderRadius: 8, background: 'var(--cr-surface-1)', color: 'var(--cr-text-primary)' }}
                  />
                </>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={bonusOncePerDay}
                  onChange={(e) => setBonusOncePerDay(e.target.checked)}
                />
                Limit bonus to once per day
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '14px 24px',
              fontSize: '1.1rem',
              fontWeight: 800,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting ? 'Setting up…' : 'Complete Setup & Launch Hub 🚀'}
          </button>
        </form>
      </div>
    </div>
  );
};
