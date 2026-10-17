import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAssetUrl, resolveAvatarUrl } from '../api';
import { SetupWizard } from './SetupWizard';

// ============================================================================
// 1. SETTINGS VIEW
// ============================================================================
export const SettingsView: React.FC = () => {
  const { data, refresh, setActiveView, showToast, playSound, theme, toggleTheme, confirm, openEditMemberModal } = useApp();
  const [tab, setTab] = useState<
    'general' | 'setup' | 'family' | 'chores' | 'extra' | 'sounds' | 'gotify' | 'calendar' | 'screensaver' | 'quiz' | 'notion'
  >('general');
  const [settingsData, setSettingsData] = useState<any>(null);

  // Notion state
  const [notionToken, setNotionToken] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [notionStatus, setNotionStatus] = useState<{ configured: boolean; message?: string } | null>(null);
  const [testingNotion, setTestingNotion] = useState(false);
  const [savingNotion, setSavingNotion] = useState(false);

  // General state
  const [tz, setTz] = useState('Australia/Brisbane');
  const [dailyResetHour, setDailyResetHour] = useState('0');
  const [rewardSys, setRewardSys] = useState<'points' | 'cash'>('points');
  const [weatherLoc, setWeatherLoc] = useState('');
  const [masterPin, setMasterPin] = useState('');

  // Family member add state
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonColor, setNewPersonColor] = useState('#3b82f6');
  const [newPersonAge, setNewPersonAge] = useState('');
  const [newPersonAdmin, setNewPersonAdmin] = useState(false);
  const [newPersonPin, setNewPersonPin] = useState('');

  // Extra chore add state
  const [ecTitle, setEcTitle] = useState('');
  const [ecPoints, setEcPoints] = useState('2');
  const [ecIcon, setEcIcon] = useState('⚡');
  const [ecMinAge, setEcMinAge] = useState('0');

  // Gotify state
  const [gotifyEnabled, setGotifyEnabled] = useState(false);
  const [gotifyUrl, setGotifyUrl] = useState('');
  const [gotifyToken, setGotifyToken] = useState('');

  // Calendar state
  const [calEnabled, setCalEnabled] = useState(false);
  const [calIcalUrl, setCalIcalUrl] = useState('');
  const [calEmbedUrl, setCalEmbedUrl] = useState('');
  const [calApiKey, setCalApiKey] = useState('');
  const [calIdsText, setCalIdsText] = useState('');

  // Screensaver state
  const [ssConfig, setSsConfig] = useState<any>(null);
  const [ssEnabled, setSsEnabled] = useState(false);
  const [ssIdleMinutes, setSsIdleMinutes] = useState('5');
  const [ssSlideSeconds, setSsSlideSeconds] = useState('15');

  const loadSettings = useCallback(async () => {
    try {
      const res = await apiGet<any>('settings_data');
      if (res?.success) {
        setSettingsData(res);
        setTz(res.timezone || 'Australia/Brisbane');
        setDailyResetHour(String(res.daily_reset_hour ?? 0));
        setRewardSys(res.reward_system || 'points');
        setWeatherLoc(res.weather?.location_name || '');
        if (res.gotify) {
          setGotifyEnabled(Boolean(res.gotify.enabled));
          setGotifyUrl(res.gotify.url || '');
          setGotifyToken(res.gotify.token || '');
        }
        if (res.google_calendar || res.gcal_ical_url) {
          setCalEnabled(Boolean(res.google_calendar_enabled ?? res.google_calendar?.enabled));
          setCalIcalUrl(res.gcal_ical_url || '');
          setCalEmbedUrl(res.gcal_embed_url || '');
          setCalApiKey(res.google_calendar_api_key || res.google_calendar?.api_key || '');
          const ids = (res.google_calendar?.calendars || []).map((c: any) =>
            typeof c === 'string' ? c : c.id
          );
          setCalIdsText(res.google_calendar_id || ids.join('\n'));
        }
      }
    } catch {
      // ignore
    }

    try {
      const ss = await apiGet<any>('screensaver/config');
      if (ss?.success) {
        setSsConfig(ss);
        setSsEnabled(Boolean(ss.enabled));
        setSsIdleMinutes(String(ss.idle_minutes ?? 5));
        setSsSlideSeconds(String(ss.slide_seconds ?? 15));
      }
    } catch {
      // ignore
    }

    try {
      const nRes = await apiGet<any>('settings/notion');
      if (nRes?.success) {
        setNotionDbId(nRes.database_id || '');
        setNotionStatus({ configured: Boolean(nRes.configured) });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveNotion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotion(true);
    try {
      const res = await apiPost<any>('settings/notion', {
        notion_token: notionToken.trim() || undefined,
        database_id: notionDbId.trim(),
      });
      if (res.success) {
        showToast('Saved Notion settings');
        setNotionStatus({ configured: Boolean(notionDbId.trim()) });
        await refresh();
      } else {
        showToast(res.error || 'Failed to save Notion settings', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save', { type: 'error' });
    } finally {
      setSavingNotion(false);
    }
  };

  const handleTestNotion = async () => {
    setTestingNotion(true);
    try {
      const res = await apiPost<any>('settings/test_notion', {
        notion_token: notionToken.trim() || undefined,
        database_id: notionDbId.trim() || undefined,
      });
      if (res.success) {
        showToast(`✅ ${res.message || 'Connected to Notion!'}`, { type: 'success' });
        setNotionStatus({ configured: true, message: res.message });
      } else {
        showToast(`❌ ${res.error || 'Connection failed'}`, { type: 'error' });
        setNotionStatus({ configured: false, message: res.error });
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Connection test failed'}`, { type: 'error' });
      setNotionStatus({ configured: false, message: err.message });
    } finally {
      setTestingNotion(false);
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('save_timezone', { timezone: tz });
      await apiPost('save_reset_hour', { daily_reset_hour: parseInt(dailyResetHour, 10) || 0 });
      await apiPost('save_reward_system', { reward_system: rewardSys });
      if (weatherLoc.trim()) {
        await apiPost('save_weather_settings', { location_name: weatherLoc.trim() });
      }
      if (masterPin.trim()) {
        await apiPost('save_pin_settings', { pin: masterPin.trim(), pin_enabled: true });
        setMasterPin('');
      }
      showToast('Saved General Settings');
      await refresh();
      await loadSettings();
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings', { type: 'error' });
    }
  };

  const handleResetDailyChoresNow = async () => {
    try {
      await apiPost('reset_daily_chores_now', {});
      showToast('Daily chores reset for today! 🧹');
      await refresh();
      await loadSettings();
    } catch (err: any) {
      showToast(err.message || 'Failed to reset chores', { type: 'error' });
    }
  };

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;
    try {
      const res = await apiPost<{ success: boolean; person?: any }>('add_person', {
        name: newPersonName.trim(),
        color: newPersonColor,
      });
      if (res.success && res.person) {
        if (newPersonAge) {
          await apiPost('save_person_age', { person_id: res.person.id, age: parseInt(newPersonAge, 10) });
        }
        if (newPersonAdmin) {
          await apiPost('save_person_pin', {
            person_id: res.person.id,
            is_admin: true,
            pin: newPersonPin.trim() || '1234',
          });
        }
      }
      setNewPersonName('');
      setNewPersonAge('');
      setNewPersonPin('');
      showToast(`Added ${newPersonName.trim()}`);
      await refresh();
      await loadSettings();
    } catch (err: any) {
      showToast(err.message || 'Failed to add person', { type: 'error' });
    }
  };

  const handleDeletePerson = async (personId: number, name: string) => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      message: `Are you sure you want to delete ${name} and all of their chores and streaks? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await apiPost('delete_person', { person_id: personId });
    showToast(`Deleted ${name}`);
    await refresh();
    await loadSettings();
  };

  const handleAdjustPoints = async (personId: number, delta: number) => {
    await apiPost('update_points', { person_id: personId, delta });
    await refresh();
    await loadSettings();
  };

  const handleAddExtraChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ecTitle.trim()) return;
    await apiPost('extra_chores/add', {
      title: ecTitle.trim(),
      points: parseFloat(ecPoints) || 2,
      icon: ecIcon || '⚡',
      min_age: parseInt(ecMinAge, 10) || 0,
    });
    setEcTitle('');
    showToast('Added Extra Chore');
    await refresh();
    await loadSettings();
  };

  const handleSaveGotify = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('save_gotify_settings', {
      enabled: gotifyEnabled,
      url: gotifyUrl.trim(),
      token: gotifyToken.trim(),
    });
    showToast('Saved Gotify settings');
  };

  const handleTestGotify = async () => {
    try {
      const res = await apiPost<{ success: boolean; error?: string }>('test_gotify', {
        url: gotifyUrl.trim(),
        token: gotifyToken.trim(),
      });
      if (res.success) {
        showToast('✅ Test notification sent to Gotify!');
      } else {
        showToast(res.error || 'Gotify test failed', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err.message || 'Gotify test failed', { type: 'error' });
    }
  };

  const handleSaveCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('save_calendar_settings', {
      google_calendar_enabled: calEnabled,
      gcal_ical_url: calIcalUrl.trim(),
      gcal_embed_url: calEmbedUrl.trim(),
      api_key: calApiKey.trim(),
      calendar_id: calIdsText.trim(),
    });
    showToast('Saved Google Calendar settings & synced!');
    await refresh();
    await loadSettings();
  };

  const handleSaveScreensaver = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('screensaver/save_settings', {
      enabled: ssEnabled,
      idle_minutes: parseInt(ssIdleMinutes, 10) || 5,
      slide_seconds: parseInt(ssSlideSeconds, 10) || 15,
      show_chores: true,
    });
    showToast('Saved Screensaver settings');
    await loadSettings();
  };

  const handleUploadScreensaverMedia = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    await apiPost('screensaver/upload_media', fd);
    showToast('Uploaded screensaver media');
    await loadSettings();
  };

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>⚙️ Household Settings</h2>
        <button
          type="button"
          onClick={() => setActiveView('dashboard')}
          className="btn-primary"
          style={{ padding: '8px 18px', borderRadius: 10 }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Settings Sub-Navigation */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { id: 'general', label: '🌐 General & Reset' },
          { id: 'setup', label: '🪄 Setup Wizard' },
          { id: 'family', label: '👨‍👩‍👧‍👦 Family Members' },
          { id: 'chores', label: '🧹 All Chores' },
          { id: 'extra', label: '⚡ Extra Chores' },
          { id: 'sounds', label: '🔊 Sounds' },
          { id: 'gotify', label: '🔔 Gotify Push' },
          { id: 'calendar', label: '📅 Google Calendar' },
          { id: 'screensaver', label: '🖼️ Screensaver' },
          { id: 'quiz', label: '🧠 Brain Quiz' },
          { id: 'notion', label: '📖 Notion Recipes' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            style={{
              padding: '9px 14px',
              borderRadius: 10,
              border: tab === t.id ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.14)',
              background: tab === t.id ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)',
              color: 'inherit',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SETUP WIZARD TAB */}
      {tab === 'setup' && (
        <SetupWizard
          embedded
          onSaved={() => {
            loadSettings();
          }}
        />
      )}

      {/* 1. GENERAL TAB */}
      {tab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="card" style={{ padding: 24, borderRadius: 18, maxWidth: 680 }}>
          <h3 style={{ marginTop: 0 }}>🌐 General, Theme & Security Settings</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Dark Mode Toggle */}
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
                  <i className={`fas ${theme === 'dark' ? 'fa-moon' : 'fa-sun'}`} style={{ marginRight: 8, color: '#fbbf24' }} />
                  Dark Mode
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.75 }}>
                  Currently {theme === 'dark' ? 'Enabled (Dark)' : 'Disabled (Light)'}
                </div>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 999,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: theme === 'dark' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.12)',
                  color: theme === 'dark' ? '#93c5fd' : 'inherit',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{theme === 'dark' ? 'ON' : 'OFF'}</span>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: theme === 'dark' ? '#3b82f6' : '#94a3b8',
                    display: 'inline-block',
                  }}
                />
              </button>
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
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
                  Daily Chore Reset Time
                </label>
                <select
                  value={dailyResetHour}
                  onChange={(e) => setDailyResetHour(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
                >
                  <option value="0">12:00 AM (Midnight — Recommended)</option>
                  <option value="1">1:00 AM</option>
                  <option value="2">2:00 AM</option>
                  <option value="3">3:00 AM</option>
                  <option value="4">4:00 AM</option>
                  <option value="5">5:00 AM</option>
                  <option value="6">6:00 AM</option>
                </select>
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
                  {settingsData?.last_daily_reset || data?.current_date || 'today'}.
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetDailyChoresNow}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                🔄 Reset Today's Chores Now
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
                Reward System
              </label>
              <select
                value={rewardSys}
                onChange={(e) => setRewardSys(e.target.value as any)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
              >
                <option value="points">⭐ Points System</option>
                <option value="cash">💵 Cash / Pocket Money ($)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
                Weather City / Suburb (Open-Meteo)
              </label>
              <input
                type="text"
                placeholder="e.g. Brisbane, Sydney, Melbourne..."
                value={weatherLoc}
                onChange={(e) => setWeatherLoc(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
                Master App Lock PIN (leave blank to keep current)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  placeholder="Set 4-digit Master PIN..."
                  value={masterPin}
                  onChange={(e) => setMasterPin(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10 }}
                />
                {data?.master_pin_set && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiPost('clear_pin', {});
                      showToast('Removed Master PIN');
                      await refresh();
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(239,68,68,0.2)',
                      color: '#f87171',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Remove PIN
                  </button>
                )}
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ padding: '12px', borderRadius: 10, fontWeight: 700 }}>
              💾 Save General Settings
            </button>
          </div>
        </form>
      )}

      {/* 2. FAMILY MEMBERS TAB */}
      {tab === 'family' && (
        <div className="card" style={{ padding: 24, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>👨‍👩‍👧‍👦 Manage Family Members</h3>
            <button
              type="button"
              onClick={() => openEditMemberModal(null)}
              className="btn-primary"
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="fas fa-user-plus" /> Add Member
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {(data?.family || []).map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.05)',
                  borderLeft: `5px solid ${p.color || '#3b82f6'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img
                    src={resolveAvatarUrl(p.avatar)}
                    alt={p.name}
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {p.name}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 8,
                          background:
                            p.role === 'parent'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : p.role === 'family'
                                ? 'rgba(59, 130, 246, 0.2)'
                                : 'rgba(16, 185, 129, 0.2)',
                          color:
                            p.role === 'parent'
                              ? '#fbbf24'
                              : p.role === 'family'
                                ? '#60a5fa'
                                : '#34d399',
                          textTransform: 'uppercase',
                        }}
                      >
                        {p.role || (p.is_admin ? 'Parent' : 'Child')}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.75 }}>
                      Balance: {p.points} pts (+{p.bonus_points} bonus) {p.age != null ? `• Age ${p.age}` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => openEditMemberModal(p)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: 'rgba(59,130,246,0.2)',
                      color: '#93c5fd',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustPoints(p.id, 1)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: 'rgba(34,197,94,0.2)',
                      color: '#4ade80',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +1 pt
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustPoints(p.id, -1)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: 'rgba(245,158,11,0.2)',
                      color: '#fbbf24',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    -1 pt
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePerson(p.id, p.name)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: 'rgba(239,68,68,0.2)',
                      color: '#f87171',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h4>➕ Add Family Member</h4>
          <form onSubmit={handleAddPerson} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Name"
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              required
              style={{ padding: '10px 12px', borderRadius: 10 }}
            />
            <input
              type="number"
              placeholder="Age (optional)"
              value={newPersonAge}
              onChange={(e) => setNewPersonAge(e.target.value)}
              style={{ width: 130, padding: '10px 12px', borderRadius: 10 }}
            />
            <input
              type="color"
              value={newPersonColor}
              onChange={(e) => setNewPersonColor(e.target.value)}
              style={{ width: 44, height: 40, border: 'none', background: 'none', cursor: 'pointer' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={newPersonAdmin}
                onChange={(e) => setNewPersonAdmin(e.target.checked)}
              />
              Parent / Admin
            </label>
            {newPersonAdmin && (
              <input
                type="password"
                placeholder="Adult PIN (e.g. 1234)"
                value={newPersonPin}
                onChange={(e) => setNewPersonPin(e.target.value)}
                style={{ width: 150, padding: '10px 12px', borderRadius: 10 }}
              />
            )}
            <button type="submit" className="btn-primary" style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 700 }}>
              + Add Member
            </button>
          </form>
        </div>
      )}

      {/* 3. ALL CHORES TAB */}
      {tab === 'chores' && (
        <div className="card" style={{ padding: 24, borderRadius: 18 }}>
          <h3 style={{ marginTop: 0 }}>🧹 All Household Chores ({data?.chores?.length || 0})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.chores || []).map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                <div>
                  <strong>
                    {c.icon || '🧹'} {c.title}
                  </strong>{' '}
                  — <span style={{ opacity: 0.8 }}>{c.assigned_to}</span> ({c.points} pts)
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiPost('delete_chore', { chore_id: c.id, permanent: true });
                    await refresh();
                  }}
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                >
                  🗑️ Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. EXTRA CHORES TAB */}
      {tab === 'extra' && (
        <div className="card" style={{ padding: 24, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>⚡ Extra Bonus Chores Pool</h3>
            <button
              type="button"
              onClick={async () => {
                await apiPost('extra_chores/reset_defaults', {});
                showToast('Reset Extra Chores to defaults');
                await refresh();
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.08)',
                color: 'inherit',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ↺ Reset Defaults
            </button>
          </div>

          <form onSubmit={handleAddExtraChore} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            <input
              type="text"
              value={ecIcon}
              onChange={(e) => setEcIcon(e.target.value)}
              style={{ width: 54, textAlign: 'center', padding: 10, borderRadius: 8 }}
            />
            <input
              type="text"
              placeholder="Extra chore title (e.g. Wash the Car)"
              value={ecTitle}
              onChange={(e) => setEcTitle(e.target.value)}
              required
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8 }}
            />
            <input
              type="number"
              step="0.5"
              placeholder="Points"
              value={ecPoints}
              onChange={(e) => setEcPoints(e.target.value)}
              style={{ width: 90, padding: '10px 12px', borderRadius: 8 }}
            />
            <input
              type="number"
              placeholder="Min Age"
              value={ecMinAge}
              onChange={(e) => setEcMinAge(e.target.value)}
              style={{ width: 90, padding: '10px 12px', borderRadius: 8 }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '10px 18px', borderRadius: 8, fontWeight: 700 }}>
              + Add Extra Chore
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.extra_chores || []).map((ec) => (
              <div
                key={ec.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                <div>
                  <strong>
                    {ec.icon} {ec.title}
                  </strong>{' '}
                  — +{ec.points} pts (Min age: {ec.min_age}+)
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiPost('extra_chores/delete', { id: ec.id });
                    await refresh();
                  }}
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. SOUNDS TAB */}
      {tab === 'sounds' && (
        <div className="card" style={{ padding: 24, borderRadius: 18 }}>
          <h3 style={{ marginTop: 0 }}>🔊 Completion Sound Effects</h3>
          <p style={{ opacity: 0.75, fontSize: '0.9rem' }}>
            Upload MP3/WAV clips to play when chores or rewards are completed.
          </p>
          <input
            type="file"
            accept="audio/*"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.append('sound', f);
              await apiPost('upload_sound', fd);
              showToast('Uploaded sound effect');
              await loadSettings();
            }}
            style={{ marginBottom: 16 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(settingsData?.sounds || []).map((s: any) => (
              <div
                key={s.filename}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                <span>🎵 {s.filename}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => playSound(s.url)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      background: 'rgba(59,130,246,0.2)',
                      color: '#60a5fa',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    ▶ Play
                  </button>
                  {s.deletable && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiPost('delete_sound', { filename: s.filename });
                        await loadSettings();
                      }}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. GOTIFY TAB */}
      {tab === 'gotify' && (
        <form onSubmit={handleSaveGotify} className="card" style={{ padding: 24, borderRadius: 18, maxWidth: 600 }}>
          <h3 style={{ marginTop: 0 }}>🔔 Gotify Push Notifications</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={gotifyEnabled}
                onChange={(e) => setGotifyEnabled(e.target.checked)}
              />
              Enable Gotify Push Notifications
            </label>
            <input
              type="text"
              placeholder="Gotify Server URL (e.g. http://192.168.1.50:8080)"
              value={gotifyUrl}
              onChange={(e) => setGotifyUrl(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 10 }}
            />
            <input
              type="password"
              placeholder="Gotify App Token"
              value={gotifyToken}
              onChange={(e) => setGotifyToken(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 10 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn-primary" style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 700 }}>
                Save Gotify Settings
              </button>
              <button
                type="button"
                onClick={handleTestGotify}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.1)',
                  color: 'inherit',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                📨 Send Test Push
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 7. GOOGLE CALENDAR TAB */}
      {tab === 'calendar' && (
        <form onSubmit={handleSaveCalendar} className="card" style={{ padding: 24, borderRadius: 18, maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>📅 Google Calendar Integration</h3>
            <button
              type="button"
              onClick={async () => {
                await apiPost('sync_calendar', {});
                showToast('Calendar synced with Google!');
                await refresh();
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="fas fa-rotate" /> Sync Now
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}>
              <input type="checkbox" checked={calEnabled} onChange={(e) => setCalEnabled(e.target.checked)} />
              Enable Google Calendar Sync
            </label>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: 4 }}>
                Secret Address in iCal Format (.ics URL) <span style={{ color: '#38bdf8', fontWeight: 500 }}>— Recommended (Zero Setup)</span>
              </label>
              <input
                type="url"
                placeholder="https://calendar.google.com/calendar/ical/.../private-.../basic.ics"
                value={calIcalUrl}
                onChange={(e) => setCalIcalUrl(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--cr-text-secondary)', display: 'block', marginTop: 4 }}>
                In Google Calendar, go to Family Calendar Settings &rarr; "Integrate calendar" &rarr; copy "Secret address in iCal format".
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: 4 }}>
                Google Calendar Embed URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://calendar.google.com/calendar/embed?src=..."
                value={calEmbedUrl}
                onChange={(e) => setCalEmbedUrl(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--cr-text-secondary)', display: 'block', marginTop: 4 }}>
                Provides an interactive full Google Calendar view on the Calendar page.
              </span>
            </div>

            <details style={{ marginTop: 6, fontSize: '0.84rem' }}>
              <summary style={{ cursor: 'pointer', color: '#94a3b8', fontWeight: 600 }}>
                ⚙️ Advanced (Google Cloud API Key / Service Account)
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 4 }}>Google API Key</label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={calApiKey}
                    onChange={(e) => setCalApiKey(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 4 }}>
                    Calendar IDs (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={calIdsText}
                    onChange={(e) => setCalIdsText(e.target.value)}
                    style={{ width: '100%', padding: 10, borderRadius: 10 }}
                  />
                </div>
              </div>
            </details>

            <button type="submit" className="btn-primary" style={{ padding: '12px 20px', borderRadius: 10, fontWeight: 700 }}>
              💾 Save Calendar Settings
            </button>
          </div>
        </form>
      )}

      {/* 8. SCREENSAVER TAB */}
      {tab === 'screensaver' && (
        <div className="card" style={{ padding: 24, borderRadius: 18 }}>
          <h3 style={{ marginTop: 0 }}>🖼️ Wall Tablet Screensaver</h3>
          <form onSubmit={handleSaveScreensaver} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500, marginBottom: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={ssEnabled} onChange={(e) => setSsEnabled(e.target.checked)} />
              Auto-start Screensaver when idle
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>Idle Timeout (minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={ssIdleMinutes}
                  onChange={(e) => setSsIdleMinutes(e.target.value)}
                  style={{ width: '100%', padding: 8, borderRadius: 8 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>Slide Duration (seconds)</label>
                <input
                  type="number"
                  min="5"
                  value={ssSlideSeconds}
                  onChange={(e) => setSsSlideSeconds(e.target.value)}
                  style={{ width: '100%', padding: 8, borderRadius: 8 }}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '10px', borderRadius: 10, fontWeight: 700 }}>
              Save Screensaver Settings
            </button>
          </form>

          <h4>📷 Upload Slideshow Photos / Videos</h4>
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => handleUploadScreensaverMedia(e.target.files)}
            style={{ marginBottom: 16 }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {(ssConfig?.media || []).map((m: any) => (
              <div key={m.filename} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', height: 100 }}>
                <img
                  src={resolveAssetUrl(m.url)}
                  alt={m.filename}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    await apiPost('screensaver/delete_media', { filename: m.filename });
                    await loadSettings();
                  }}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: 'rgba(0,0,0,0.7)',
                    color: '#f87171',
                    border: 'none',
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. QUIZ TAB */}
      {tab === 'quiz' && (
        <div className="card" style={{ padding: 24, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>🧠 Daily Brain Quiz Questions ({data?.quiz_questions?.length || 0})</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(data?.quiz_questions_enabled)}
                onChange={async (e) => {
                  await apiPost('save_quiz_settings', { quiz_questions_enabled: e.target.checked });
                  await refresh();
                }}
              />
              Enable Daily Quiz on All-Done Celebration
            </label>
          </div>
          <p style={{ opacity: 0.75, fontSize: '0.88rem' }}>
            Age-matched questions shown when a child finishes all their daily chores.
          </p>
        </div>
      )}

      {/* 10. NOTION TAB */}
      {tab === 'notion' && (
        <form onSubmit={handleSaveNotion} className="card" style={{ padding: 24, borderRadius: 18, maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>📖 Notion Recipe Integration</h3>
            {notionStatus?.configured ? (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(34, 197, 94, 0.18)',
                  color: '#4ade80',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                ✓ Configured
              </span>
            ) : (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(234, 179, 8, 0.18)',
                  color: '#facc15',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                Not Configured
              </span>
            )}
          </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--cr-text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
            Connect your Notion recipe database to sync recipes, ingredients, servings, and cooking directions directly into the Meal Planner with a single click.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700 }}>
                Notion Integration Token <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="password"
                value={notionToken}
                onChange={(e) => setNotionToken(e.target.value)}
                placeholder="secret_..."
                className="modern-input"
                autoComplete="off"
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--cr-text-secondary)' }}>
                Create an internal integration at <strong>notion.so/my-integrations</strong> and paste the secret token here.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 700 }}>
                Notion Database ID or URL <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={notionDbId}
                onChange={(e) => setNotionDbId(e.target.value)}
                placeholder="e.g. 1a2b3c4d5e6f... or full Notion database URL"
                className="modern-input"
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--cr-text-secondary)' }}>
                Copy the 32-character ID from your Notion database URL (or paste the entire database URL).
              </span>
            </div>

            {/* Guide notice */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                fontSize: '0.82rem',
                color: '#c7d2fe',
                lineHeight: 1.5,
              }}
            >
              <strong>💡 Important:</strong> In Notion, open your recipe database, click the <strong>•••</strong> menu at top right → <strong>Connections</strong> → <strong>Add connection</strong>, and select your integration.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn-cancel"
                disabled={testingNotion}
                onClick={handleTestNotion}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <i className={testingNotion ? 'fas fa-spinner fa-spin' : 'fas fa-plug'} />
                {testingNotion ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={savingNotion}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <i className="fas fa-check" />
                {savingNotion ? 'Saving...' : 'Save Notion Settings'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

// ============================================================================
// 2. ACTIVITY LOG VIEW
// ============================================================================
export const ActivityLogView: React.FC = () => {
  const { setActiveView } = useApp();
  const [logs, setLogs] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    const q = filterType ? `activity_log_data?action_type=${encodeURIComponent(filterType)}` : 'activity_log_data';
    apiGet<any>(q)
      .then((res) => {
        if (res?.logs) setLogs(res.logs);
      })
      .catch(() => {});
  }, [filterType]);

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>📜 Activity & Point Log</h2>
        <button
          type="button"
          onClick={() => setActiveView('dashboard')}
          className="btn-primary"
          style={{ padding: '8px 18px', borderRadius: 10 }}
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="card" style={{ padding: 20, borderRadius: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8 }}
          >
            <option value="">All Activity Types</option>
            <option value="chore_completed">Chore Completed</option>
            <option value="reward_redeemed">Reward Redeemed</option>
            <option value="bonus_points">Bonus Points</option>
            <option value="badge_earned">Badge Earned</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map((l) => (
            <div
              key={l.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{l.description}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.65 }}>{l.action_type}</div>
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                {new Date(l.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. CHORE HISTORY VIEW
// ============================================================================
export const ChoreHistoryView: React.FC = () => {
  const { setActiveView } = useApp();
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
        <button
          type="button"
          onClick={() => setActiveView('dashboard')}
          className="btn-primary"
          style={{ padding: '8px 18px', borderRadius: 10 }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {historyData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
          {(historyData.leaderboard || []).map((p: any) => (
            <div key={p.id} className="card" style={{ padding: 18, borderRadius: 16, textAlign: 'center' }}>
              <img
                src={resolveAvatarUrl(p.avatar)}
                alt={p.name}
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
