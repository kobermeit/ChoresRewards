import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';
import { useApp } from '../context/AppContext';
import { Button, Select, Input, Card } from './ui';

export const SetupWizard: React.FC<{ embedded?: boolean; onSaved?: () => void }> = ({
  embedded = false,
  onSaved,
}) => {
  const { data, refresh, showToast, setActiveView } = useApp();
  const [rewardSystem, setRewardSystem] = useState<'points' | 'cash'>(data?.reward_system || 'points');
  const [bonusMode, setBonusMode] = useState<'static' | 'range' | 'none'>('static');
  const [bonusStatic, setBonusStatic] = useState('10');
  const [bonusMin, setBonusMin] = useState('2');
  const [bonusMax, setBonusMax] = useState('8');
  const [bonusOncePerDay, setBonusOncePerDay] = useState(true);
  const [dailyResetHour, setDailyResetHour] = useState('0');
  const [timezone, setTimezone] = useState(() => {
    if (data?.timezone) return data.timezone;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Brisbane';
    } catch {
      return 'Australia/Brisbane';
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGet<any>('settings')
      .then((res) => {
        if (res?.success) {
          if (res.reward_system) setRewardSystem(res.reward_system);
          if (res.bonus_mode) setBonusMode(res.bonus_mode);
          if (res.bonus_static !== undefined) setBonusStatic(String(res.bonus_static));
          if (res.bonus_min !== undefined) setBonusMin(String(res.bonus_min));
          if (res.bonus_max !== undefined) setBonusMax(String(res.bonus_max));
          if (res.bonus_once_per_day !== undefined) setBonusOncePerDay(Boolean(res.bonus_once_per_day));
          if (res.timezone) setTimezone(res.timezone);
          if (res.daily_reset_hour !== undefined) setDailyResetHour(String(res.daily_reset_hour));
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiPost('setup', {
        reward_system: rewardSystem,
        bonus_mode: bonusMode,
        bonus_static: bonusStatic,
        bonus_min: bonusMin,
        bonus_max: bonusMax,
        bonus_once_per_day: bonusOncePerDay,
        timezone,
        daily_reset_hour: parseInt(dailyResetHour, 10) || 0,
      });

      if (!res?.success) {
        setError(res?.error || (res?.errors && res.errors[0]) || 'Failed to complete setup.');
      } else {
        showToast(embedded ? 'Household defaults saved! ✨' : 'Welcome to Chores & Rewards! 🎉');
        await refresh();
        onSaved?.();
      }
    } catch (err: any) {
      setError(err?.message || 'Error saving setup');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: embedded ? '100%' : 780, margin: embedded ? '0' : '36px auto', padding: embedded ? '0' : '0 20px' }}>
      <Card style={{ padding: embedded ? 24 : 32, borderRadius: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>⚙️</div>
          <h2 style={{ margin: '0 0 6px', color: 'var(--cr-text-primary)', fontWeight: 800 }}>
            {embedded ? 'Household System Defaults' : 'Household Setup Wizard'}
          </h2>
          <p style={{ margin: 0, color: 'var(--cr-text-secondary)', fontSize: '0.95rem' }}>
            Configure your reward economy, timezone reset schedule, and daily bonus points.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5',
              fontSize: '0.9rem',
              fontWeight: 600,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Note linking to dedicated Family Members settings */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              padding: '14px 18px',
              borderRadius: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.4rem' }}>👨‍👩‍👧‍👦</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#93c5fd' }}>
                  Managing Family Members & Avatars
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--cr-text-secondary)' }}>
                  Family profiles, colors, adult PINs, and personal calendars are organized in the Family Members tab.
                </div>
              </div>
            </div>
            {embedded && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon="fas fa-arrow-right"
                onClick={() => {
                  const ev = new CustomEvent('navigate-settings-tab', { detail: 'family' });
                  window.dispatchEvent(ev);
                }}
              >
                Go to Family
              </Button>
            )}
          </div>

          {/* Reward System, Timezone & Daily Reset Time */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
            <div
              style={{
                background: 'var(--cr-surface-2)',
                padding: 18,
                borderRadius: 14,
                border: '1px solid var(--cr-surface-border)',
              }}
            >
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 8, color: 'var(--cr-text-primary)', fontSize: '0.9rem' }}>
                ⭐ Reward System Economy
              </label>
              <Select
                value={rewardSystem}
                onChange={(e) => setRewardSystem(e.target.value as 'points' | 'cash')}
                options={[
                  { value: 'points', label: 'Points (⭐ e.g. 10 pts)' },
                  { value: 'cash', label: 'Cash / Money (💵 e.g. $2.50)' },
                ]}
              />
            </div>

            <div
              style={{
                background: 'var(--cr-surface-2)',
                padding: 18,
                borderRadius: 14,
                border: '1px solid var(--cr-surface-border)',
              }}
            >
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 8, color: 'var(--cr-text-primary)', fontSize: '0.9rem' }}>
                🌐 Household Timezone
              </label>
              <Input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. Australia/Brisbane"
              />
            </div>

            <div
              style={{
                background: 'var(--cr-surface-2)',
                padding: 18,
                borderRadius: 14,
                border: '1px solid var(--cr-surface-border)',
              }}
            >
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 8, color: 'var(--cr-text-primary)', fontSize: '0.9rem' }}>
                ⏰ Daily Reset Schedule
              </label>
              <Select
                value={dailyResetHour}
                onChange={(e) => setDailyResetHour(e.target.value)}
                options={[
                  { value: '0', label: '12:00 AM (Midnight — Recommended)' },
                  { value: '1', label: '1:00 AM' },
                  { value: '2', label: '2:00 AM' },
                  { value: '3', label: '3:00 AM' },
                  { value: '4', label: '4:00 AM' },
                  { value: '5', label: '5:00 AM' },
                  { value: '6', label: '6:00 AM' },
                ]}
              />
            </div>
          </div>

          {/* Daily All-Done Bonus Mode */}
          <div
            style={{
              background: 'var(--cr-surface-2)',
              padding: 18,
              borderRadius: 14,
              border: '1px solid var(--cr-surface-border)',
            }}
          >
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 10, color: 'var(--cr-text-primary)', fontSize: '0.9rem' }}>
              🎰 Daily All-Done Bonus Mode
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              <div style={{ minWidth: 200, flex: 1 }}>
                <Select
                  value={bonusMode}
                  onChange={(e) => setBonusMode(e.target.value as any)}
                  options={[
                    { value: 'static', label: 'Fixed Bonus Amount' },
                    { value: 'range', label: 'Random Slot Machine Range' },
                    { value: 'none', label: 'No Bonus Points' },
                  ]}
                />
              </div>

              {bonusMode === 'static' && (
                <div style={{ width: 120 }}>
                  <Input
                    type="number"
                    value={bonusStatic}
                    onChange={(e) => setBonusStatic(e.target.value)}
                    placeholder="Points"
                  />
                </div>
              )}

              {bonusMode === 'range' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 90 }}>
                    <Input
                      type="number"
                      value={bonusMin}
                      onChange={(e) => setBonusMin(e.target.value)}
                      placeholder="Min"
                    />
                  </div>
                  <span style={{ color: 'var(--cr-text-secondary)', fontWeight: 600 }}>to</span>
                  <div style={{ width: 90 }}>
                    <Input
                      type="number"
                      value={bonusMax}
                      onChange={(e) => setBonusMax(e.target.value)}
                      placeholder="Max"
                    />
                  </div>
                </div>
              )}

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={bonusOncePerDay}
                  onChange={(e) => setBonusOncePerDay(e.target.checked)}
                />
                Limit bonus to once per day
              </label>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={submitting}
            icon={submitting ? 'fas fa-spinner fa-spin' : embedded ? 'fas fa-check' : 'fas fa-rocket'}
          >
            {submitting ? 'Saving defaults…' : embedded ? 'Save System Defaults' : 'Complete Setup & Launch Hub'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
