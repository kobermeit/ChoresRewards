import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { apiGet, apiPost } from '../../../api';
import { Button, Input, Select } from '../../../components/ui';

export interface GeneralSettingsTabProps {
  initialSettings?: any;
  onSettingsUpdated?: () => void;
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  initialSettings,
  onSettingsUpdated,
}) => {
  const { data, refresh, showToast } = useApp();
  const [tz, setTz] = useState('Australia/Brisbane');
  const [dailyResetHour, setDailyResetHour] = useState('0');
  const [rewardSys, setRewardSys] = useState<'points' | 'cash'>('points');
  const [pointValue, setPointValue] = useState('0.50');
  const [weatherLoc, setWeatherLoc] = useState('');
  const [masterPin, setMasterPin] = useState('');
  const [lastDailyReset, setLastDailyReset] = useState<string | null>(null);

  useEffect(() => {
    if (initialSettings) {
      setTz(initialSettings.timezone || 'Australia/Brisbane');
      setDailyResetHour(String(initialSettings.daily_reset_hour ?? 0));
      setRewardSys(initialSettings.reward_system || 'points');
      setPointValue(String(initialSettings.point_value ?? (data?.point_value ?? '0.50')));
      setWeatherLoc(initialSettings.weather?.location_name || '');
      setLastDailyReset(initialSettings.last_daily_reset || null);
    } else {
      apiGet<any>('settings_data').then((res) => {
        if (res?.success) {
          setTz(res.timezone || 'Australia/Brisbane');
          setDailyResetHour(String(res.daily_reset_hour ?? 0));
          setRewardSys(res.reward_system || 'points');
          setPointValue(String(res.point_value ?? (data?.point_value ?? '0.50')));
          setWeatherLoc(res.weather?.location_name || '');
          setLastDailyReset(res.last_daily_reset || null);
        }
      }).catch(() => {});
    }
  }, [initialSettings, data?.point_value]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('save_timezone', { timezone: tz });
      await apiPost('save_reset_hour', { daily_reset_hour: parseInt(dailyResetHour, 10) || 0 });
      await apiPost('save_reward_system', { reward_system: rewardSys });
      await apiPost('save_settings', { point_value: parseFloat(pointValue) || 0.50 });
      if (weatherLoc.trim()) {
        await apiPost('save_weather_settings', { location_name: weatherLoc.trim() });
      }
      if (masterPin.trim()) {
        await apiPost('save_pin_settings', { pin: masterPin.trim(), pin_enabled: true });
        setMasterPin('');
      }
      showToast('Saved General Settings');
      await refresh();
      onSettingsUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings', { type: 'error' });
    }
  };

  const handleResetDailyChoresNow = async () => {
    try {
      await apiPost('reset_daily_chores_now', {});
      showToast('Daily chores reset for today! 🧹');
      await refresh();
      onSettingsUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to reset chores', { type: 'error' });
    }
  };

  return (
    <form onSubmit={handleSaveGeneral} className="card" style={{ padding: 24, borderRadius: 18, maxWidth: 680 }}>
      <h3 style={{ marginTop: 0 }}>🌐 General, Theme & Security Settings</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Dark Mode Information */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
              <i className="fas fa-moon" style={{ marginRight: 8, color: '#fbbf24' }} />
              Display Theme: Dark Mode
            </div>
            <div style={{ fontSize: '0.78rem', opacity: 0.75 }}>
              Dark mode is permanently active as the default high-contrast theme for family tablets.
            </div>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(59, 130, 246, 0.2)',
              color: '#93c5fd',
              border: '1px solid rgba(59, 130, 246, 0.35)',
            }}
          >
            Default
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
              Household Timezone
            </label>
            <input
              type="text"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              placeholder="Australia/Brisbane"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <Select
              label="Daily Chore Reset Time"
              value={dailyResetHour}
              onChange={(e) => setDailyResetHour(e.target.value)}
            >
              <option value="0">12:00 AM (Midnight — Recommended)</option>
              <option value="1">1:00 AM</option>
              <option value="2">2:00 AM</option>
              <option value="3">3:00 AM</option>
              <option value="4">4:00 AM</option>
              <option value="5">5:00 AM</option>
              <option value="6">6:00 AM</option>
            </Select>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.28)',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Manual Daily Chore Reset</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>
              Un-ticks all daily chores for today ({data?.current_date || 'today'}). Last automatic reset:{' '}
              {lastDailyReset || data?.current_date || 'today'}.
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon="fas fa-rotate"
            onClick={handleResetDailyChoresNow}
          >
            Reset Today's Chores Now
          </Button>
        </div>

        <Select
          label="Reward System"
          value={rewardSys}
          onChange={(e) => setRewardSys(e.target.value as any)}
        >
          <option value="points">⭐ Points System</option>
          <option value="cash">💵 Cash / Pocket Money ($)</option>
        </Select>

        <Input
          label="Reward Point Dollar Value ($)"
          type="number"
          step="0.05"
          min="0.01"
          placeholder="0.50"
          value={pointValue}
          onChange={(e) => setPointValue(e.target.value)}
          helperText="Defines the monetary value of 1 point (e.g. 0.50 means 1 pt = $0.50). When importing rewards from Amazon/web links, points are automatically calculated from price divided by this value."
        />

        <Input
          label="Weather City / Suburb (Open-Meteo)"
          type="text"
          placeholder="e.g. Brisbane, Sydney, Melbourne..."
          value={weatherLoc}
          onChange={(e) => setWeatherLoc(e.target.value)}
        />

        <div>
          <Input
            label="Master App Lock PIN (leave blank to keep current)"
            type="password"
            placeholder="Set 4-digit Master PIN..."
            value={masterPin}
            onChange={(e) => setMasterPin(e.target.value)}
          />
          {data?.master_pin_set && (
            <div style={{ marginTop: 8 }}>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await apiPost('clear_pin', {});
                  showToast('Removed Master PIN');
                  await refresh();
                  onSettingsUpdated?.();
                }}
              >
                Remove PIN
              </Button>
            </div>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          icon="fas fa-save"
        >
          Save General Settings
        </Button>
      </div>
    </form>
  );
};

export default GeneralSettingsTab;
