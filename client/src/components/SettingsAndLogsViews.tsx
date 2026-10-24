import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAssetUrl, resolveAvatarUrl } from '../api';
import { SetupWizard } from './SetupWizard';
import { SeasonalSettingsView } from './SeasonalSettingsView';
import { Button, Input, Select, Card, Badge, FormGrid, FormField, WipBanner } from './ui';
import { Modal } from './common/Modal';

// ============================================================================
// 1. SETTINGS VIEW
// ============================================================================
export const SettingsView: React.FC = () => {
  const { data, refresh, setActiveView, showToast, playSound, theme, toggleTheme, confirm, openEditMemberModal, openEditChoreModal } = useApp();
  const [tab, setTab] = useState<
    'general' | 'setup' | 'seasonal' | 'family' | 'chores' | 'extra' | 'sounds' | 'discord' | 'calendar' | 'screensaver' | 'quiz' | 'notion'
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

  // Extra bonus chore modal state
  const [editingBonusChore, setEditingBonusChore] = useState<any | null>(null);
  const [isNewBonusChore, setIsNewBonusChore] = useState(false);
  const [bonusModalTitle, setBonusModalTitle] = useState('');
  const [bonusModalPoints, setBonusModalPoints] = useState('2');
  const [bonusModalIcon, setBonusModalIcon] = useState('⚡');
  const [bonusModalMinAge, setBonusModalMinAge] = useState('0');
  const [bonusModalMaxAge, setBonusModalMaxAge] = useState('');
  const [bonusModalEnabled, setBonusModalEnabled] = useState(true);
  const [savingBonusChore, setSavingBonusChore] = useState(false);

  // Discord state
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [discordNotifyChores, setDiscordNotifyChores] = useState(true);
  const [discordNotifyRewards, setDiscordNotifyRewards] = useState(true);
  const [testingDiscord, setTestingDiscord] = useState(false);

  // Calendar state
  const [calEnabled, setCalEnabled] = useState(false);
  const [calIcalUrl, setCalIcalUrl] = useState('');
  const [calEmbedUrl, setCalEmbedUrl] = useState('');
  const [calFormError, setCalFormError] = useState<string | null>(null);

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
        if (res.discord) {
          setDiscordEnabled(Boolean(res.discord.enabled));
          setDiscordWebhookUrl(res.discord.webhook_url || '');
          setDiscordNotifyChores(res.discord.notify_chores !== false);
          setDiscordNotifyRewards(res.discord.notify_rewards !== false);
        }
        if (res.google_calendar || res.gcal_ical_url !== undefined || res.gcal_embed_url !== undefined) {
          setCalEnabled(Boolean(res.google_calendar_enabled ?? res.google_calendar?.enabled));
          setCalIcalUrl(res.gcal_ical_url || res.google_calendar?.ical_url || '');
          setCalEmbedUrl(res.gcal_embed_url || res.google_calendar?.embed_url || '');
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

  const openAddBonusChoreModal = () => {
    setIsNewBonusChore(true);
    setBonusModalTitle('');
    setBonusModalPoints('2');
    setBonusModalIcon('⚡');
    setBonusModalMinAge('0');
    setBonusModalMaxAge('');
    setBonusModalEnabled(true);
    setEditingBonusChore({ id: '' });
  };

  const openEditBonusChoreModal = (chore: any) => {
    setIsNewBonusChore(false);
    setBonusModalTitle(chore.title || '');
    setBonusModalPoints(String(chore.points ?? 2));
    setBonusModalIcon(chore.icon || '⚡');
    setBonusModalMinAge(String(chore.min_age ?? 0));
    setBonusModalMaxAge(chore.max_age !== null && chore.max_age !== undefined ? String(chore.max_age) : '');
    setBonusModalEnabled(chore.enabled !== false);
    setEditingBonusChore(chore);
  };

  const handleSaveBonusChoreModal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!bonusModalTitle.trim()) {
      showToast('Chore title cannot be empty', { type: 'error' });
      return;
    }
    setSavingBonusChore(true);
    try {
      if (isNewBonusChore) {
        await apiPost('extra_chores/add', {
          title: bonusModalTitle.trim(),
          points: parseFloat(bonusModalPoints) || 2,
          icon: bonusModalIcon.trim() || '⚡',
          min_age: parseInt(bonusModalMinAge, 10) || 0,
          max_age: bonusModalMaxAge.trim() ? parseInt(bonusModalMaxAge, 10) : null,
          enabled: bonusModalEnabled,
        });
        showToast(`Added bonus chore "${bonusModalTitle.trim()}"`);
      } else if (editingBonusChore) {
        await apiPost('extra_chores/edit', {
          id: editingBonusChore.id,
          title: bonusModalTitle.trim(),
          points: parseFloat(bonusModalPoints) || 2,
          icon: bonusModalIcon.trim() || '⚡',
          min_age: parseInt(bonusModalMinAge, 10) || 0,
          max_age: bonusModalMaxAge.trim() ? parseInt(bonusModalMaxAge, 10) : null,
          enabled: bonusModalEnabled,
        });
        showToast(`Updated bonus chore "${bonusModalTitle.trim()}"`);
      }
      setEditingBonusChore(null);
      await refresh();
      await loadSettings();
    } catch (err: any) {
      showToast(err.message || 'Failed to save bonus chore', { type: 'error' });
    } finally {
      setSavingBonusChore(false);
    }
  };

  const handleSaveDiscord = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('save_discord_settings', {
      discord_webhook_url: discordWebhookUrl.trim(),
      discord_notify_chores: discordNotifyChores,
      discord_notify_rewards: discordNotifyRewards,
    });
    showToast('Saved Discord Webhook settings');
    await loadSettings();
  };

  const handleTestDiscord = async () => {
    setTestingDiscord(true);
    try {
      const res = await apiPost<{ success: boolean; message?: string; error?: string }>('test_discord', {
        discord_webhook_url: discordWebhookUrl.trim(),
      });
      if (res.success) {
        showToast(res.message || '✅ Test notification sent to Discord!');
      } else {
        showToast(res.error || 'Discord webhook test failed', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err.message || 'Discord webhook test failed', { type: 'error' });
    } finally {
      setTestingDiscord(false);
    }
  };

  const handleSaveCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalFormError(null);
    try {
      await apiPost('save_calendar_settings', {
        google_calendar_enabled: calEnabled,
        gcal_ical_url: calIcalUrl.trim(),
        gcal_embed_url: calEmbedUrl.trim(),
      });
      showToast('Saved Google Calendar settings & synced!');
      await refresh();
      await loadSettings();
    } catch (err: any) {
      const msg = err.message || 'Failed to save calendar settings';
      setCalFormError(msg);
      showToast(msg, { type: 'error' });
    }
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

  // Listen for custom tab navigation events (e.g. from SetupWizard)
  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail) setTab(e.detail);
    };
    window.addEventListener('navigate-settings-tab', handleNavigate);
    return () => window.removeEventListener('navigate-settings-tab', handleNavigate);
  }, []);

  const navGroups = [
    {
      group: 'System & Preferences',
      items: [
        { id: 'general', label: 'General & Security', icon: 'fas fa-sliders', badge: null },
        { id: 'setup', label: 'System Defaults', icon: 'fas fa-wand-magic-sparkles', badge: null },
        { id: 'seasonal', label: 'Seasonal Themes', icon: 'fas fa-calendar-star', badge: null },
        { id: 'screensaver', label: 'Screensaver', icon: 'fas fa-image', badge: ssEnabled ? 'Active' : null },
        { id: 'sounds', label: 'Sound FX', icon: 'fas fa-volume-high', badge: null },
      ],
    },
    {
      group: 'Household & Tasks',
      items: [
        { id: 'family', label: 'Family Members', icon: 'fas fa-users', badge: data?.family?.length ? `${data.family.length}` : null },
        { id: 'chores', label: 'All Chores Catalog', icon: 'fas fa-broom', badge: null },
        { id: 'extra', label: 'Extra Bonus Pool', icon: 'fas fa-bolt', badge: null },
        { id: 'quiz', label: 'Daily Brain Quiz', icon: 'fas fa-brain', badge: null },
      ],
    },
    {
      group: 'Connected Integrations',
      items: [
        { id: 'calendar', label: 'Google Calendar', icon: 'fas fa-calendar-days', badge: calEnabled ? 'Connected' : 'Off' },
        { id: 'discord', label: 'Discord Webhook', icon: 'fab fa-discord', badge: discordWebhookUrl.trim() ? 'Active' : null },
        { id: 'notion', label: 'Notion Recipes', icon: 'fas fa-book-open', badge: notionStatus?.configured ? 'Linked' : null },
      ],
    },
  ];

  return (
    <div style={{ padding: '16px 0 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800 }}>⚙️ Household Settings</h2>
          <p style={{ margin: 0, color: 'var(--cr-text-secondary)', fontSize: '0.88rem' }}>
            Manage family profiles, task schedules, integrations, and display preferences.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setActiveView('dashboard')}
          variant="secondary"
          size="sm"
          icon="fas fa-arrow-left"
        >
          Back to Dashboard
        </Button>
      </div>

      {/* Modern Two-Column Layout (MakerWorld / Linear style) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 260px) 1fr',
          gap: 24,
          alignItems: 'flex-start',
        }}
        className="settings-layout-grid"
      >
        {/* Left Navigation Sidebar */}
        <div
          style={{
            background: 'var(--cr-surface-1)',
            border: '1px solid var(--cr-surface-border)',
            borderRadius: 18,
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            position: 'sticky',
            top: 80,
          }}
        >
          {navGroups.map((g, gIdx) => (
            <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--cr-text-secondary)',
                  padding: '4px 10px 6px',
                  opacity: 0.8,
                }}
              >
                {g.group}
              </div>
              {g.items.map((item) => {
                const isActive = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: isActive ? 'var(--color-primary-subtle, rgba(2, 132, 199, 0.18))' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                      borderLeft: isActive ? '3px solid var(--color-primary-highlight, #38bdf8)' : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <i
                        className={item.icon}
                        style={{
                          width: 16,
                          textAlign: 'center',
                          color: isActive ? 'var(--color-primary-highlight, #38bdf8)' : 'var(--color-text-muted)',
                        }}
                      />
                      <span style={{ color: isActive ? '#ffffff' : 'inherit' }}>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 7px',
                          borderRadius: 999,
                          fontWeight: 700,
                          background:
                            item.badge === 'Connected' || item.badge === 'Active' || item.badge === 'Linked'
                              ? 'rgba(34, 197, 94, 0.2)'
                              : 'rgba(255, 255, 255, 0.08)',
                          color:
                            item.badge === 'Connected' || item.badge === 'Active' || item.badge === 'Linked'
                              ? '#4ade80'
                              : 'var(--cr-text-secondary)',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right Content Column */}
        <div style={{ minWidth: 0 }}>
          <WipBanner />

      {/* SETUP WIZARD TAB */}
      {tab === 'setup' && (
        <SetupWizard
          embedded
          onSaved={() => {
            loadSettings();
          }}
        />
      )}

      {/* SEASONAL THEMES TAB */}
      {tab === 'seasonal' && <SeasonalSettingsView />}

      {/* 1. GENERAL TAB */}
      {tab === 'general' && (
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
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10 }}
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
                  {settingsData?.last_daily_reset || data?.current_date || 'today'}.
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
      )}

      {/* 2. FAMILY MEMBERS TAB */}
      {tab === 'family' && (
        <div className="card" style={{ padding: 24, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>👨‍👩‍👧‍👦 Manage Family Members</h3>
            <Button
              variant="primary"
              size="sm"
              icon="fas fa-user-plus"
              onClick={() => openEditMemberModal(null)}
            >
              Add Member
            </Button>
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
                  borderRadius: 'var(--card-radius)',
                  background: 'rgba(255,255,255,0.05)',
                  borderLeft: `5px solid ${p.color || '#3b82f6'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img
                    src={resolveAvatarUrl(p.avatar)}
                    alt={p.name}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                    }}
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
                    <div style={{ fontSize: '0.82rem', opacity: 0.75, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>Balance: {p.points} pts (+{p.bonus_points} bonus) {p.age != null ? `• Age ${p.age}` : ''}</span>
                      {p.calendar_ical_url && (
                        <span style={{ fontSize: '0.72rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <i className="fas fa-calendar-check" /> Cal Linked
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="fas fa-pencil-alt"
                    onClick={() => openEditMemberModal(p)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAdjustPoints(p.id, 1)}
                  >
                    +1 pt
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAdjustPoints(p.id, -1)}
                  >
                    -1 pt
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon="fas fa-trash-alt"
                    onClick={() => handleDeletePerson(p.id, p.name)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <h4>➕ Add Family Member</h4>
          <FormGrid onSubmit={handleAddPerson} style={{ alignItems: 'flex-end' }}>
            <FormField colSpan={4}>
              <Input
                label="Name *"
                type="text"
                placeholder="Name"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                required
              />
            </FormField>
            <FormField colSpan={2}>
              <Input
                label="Age"
                type="number"
                placeholder="e.g. 8"
                value={newPersonAge}
                onChange={(e) => setNewPersonAge(e.target.value)}
              />
            </FormField>
            <FormField colSpan={2}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Color</label>
                <input
                  type="color"
                  value={newPersonColor}
                  onChange={(e) => setNewPersonColor(e.target.value)}
                  style={{ width: '100%', height: 42, borderRadius: 'var(--input-radius)', border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-base)', cursor: 'pointer', padding: 2 }}
                  title="Accent Color"
                />
              </div>
            </FormField>
            <FormField colSpan={2}>
              <div style={{ height: 42, display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={newPersonAdmin}
                    onChange={(e) => setNewPersonAdmin(e.target.checked)}
                  />
                  Parent / Admin
                </label>
              </div>
            </FormField>
            {newPersonAdmin ? (
              <FormField colSpan={2}>
                <Input
                  label="PIN"
                  type="password"
                  placeholder="PIN"
                  value={newPersonPin}
                  onChange={(e) => setNewPersonPin(e.target.value)}
                />
              </FormField>
            ) : null}
            <FormField colSpan={newPersonAdmin ? 12 : 2}>
              <Button type="submit" variant="primary" icon="fas fa-plus" fullWidth={newPersonAdmin}>
                Add Member
              </Button>
            </FormField>
          </FormGrid>
        </div>
      )}

      {/* 3. ALL CHORES TAB */}
      {tab === 'chores' && (
        <div className="card" style={{ padding: 24, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>🧹 All Household Chores ({data?.chores?.length || 0})</h3>
            <Button
              variant="primary"
              size="sm"
              icon="fas fa-plus"
              onClick={() => openEditChoreModal(null)}
            >
              Add Chore
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data?.chores || []).map((c) => {
              const assignedPerson = (data?.family || []).find((p) => p.name === c.assigned_to);
              const memberColor = assignedPerson?.color || '#3b82f6';
              const rawDays = c.days_of_week ? c.days_of_week.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean) : [];
              let daysText = c.is_daily ? 'Every day' : 'Once-off';
              if (rawDays.length >= 7) {
                daysText = 'Every day';
              } else if (rawDays.length === 5 && ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].every((d) => rawDays.includes(d))) {
                daysText = 'Mon – Fri';
              } else if (rawDays.length === 2 && ['saturday', 'sunday'].every((d) => rawDays.includes(d))) {
                daysText = 'Weekends';
              } else if (rawDays.length > 0) {
                const mapDay: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
                daysText = rawDays.map((d) => mapDay[d] || d.slice(0, 3)).join(', ');
              }

              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 'var(--card-radius)',
                    background: 'rgba(255,255,255,0.05)',
                    borderLeft: `5px solid ${memberColor}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {c.image_url ? (
                      <img
                        src={resolveAssetUrl(c.image_url)}
                        alt={c.title}
                        style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: `${memberColor}22`,
                          border: `1.5px solid ${memberColor}44`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.4rem',
                        }}
                      >
                        {c.icon || '🧹'}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.02rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span>{c.title}</span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: `${memberColor}22`,
                            color: memberColor,
                            border: `1px solid ${memberColor}44`,
                          }}
                        >
                          {c.assigned_to}
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.08)',
                            color: '#cbd5e1',
                          }}
                        >
                          {daysText}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>
                          {data?.reward_system === 'cash' ? `$${Number(c.points).toFixed(2)}` : `${c.points} pts`}
                        </span>
                        {c.due_datetime && (
                          <span style={{ color: '#f87171' }}>• Due {c.due_datetime}</span>
                        )}
                        {c.completed ? (
                          <span style={{ color: '#4ade80', fontWeight: 700 }}>• Done today</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="fas fa-pencil-alt"
                      onClick={() => openEditChoreModal(c)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon="fas fa-trash-alt"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete Chore',
                          message: `Are you sure you want to permanently delete "${c.title}"?`,
                          confirmText: 'Delete',
                          danger: true,
                        });
                        if (ok) {
                          await apiPost('delete_chore', { chore_id: c.id, permanent: true });
                          showToast(`Deleted chore "${c.title}"`);
                          await refresh();
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
            {(data?.chores || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px', opacity: 0.6 }}>
                No chores found. Tap &quot;Add Chore&quot; to create your first household chore!
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. EXTRA CHORES TAB */}
      {tab === 'extra' && (
        <div className="card" style={{ padding: 24, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>⚡ Extra Bonus Chores Pool ({(data?.extra_chores || []).length})</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button
                variant="secondary"
                size="sm"
                icon="fas fa-rotate"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Reset Bonus Chores?',
                    message: 'Are you sure you want to restore the default bonus chores pool? Custom bonus chores will be reset.',
                    confirmText: 'Reset Defaults',
                    danger: true,
                  });
                  if (!ok) return;
                  await apiPost('extra_chores/reset_defaults', {});
                  showToast('Reset Extra Chores to defaults');
                  await refresh();
                  await loadSettings();
                }}
              >
                Reset Defaults
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="fas fa-plus"
                onClick={openAddBonusChoreModal}
              >
                Add Bonus Chore
              </Button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data?.extra_chores || []).map((ec) => {
              const ageLabel = ec.max_age
                ? `Ages ${ec.min_age}–${ec.max_age}`
                : ec.min_age > 0
                ? `Age ${ec.min_age}+`
                : 'All ages';

              return (
                <div
                  key={ec.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 'var(--card-radius)',
                    background: 'rgba(255,255,255,0.05)',
                    borderLeft: '5px solid #f59e0b',
                    opacity: ec.enabled ? 1 : 0.6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1.5px solid rgba(245, 158, 11, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem',
                        flexShrink: 0,
                      }}
                    >
                      {ec.icon || '⚡'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.02rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span>{ec.title}</span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                          }}
                        >
                          {ageLabel}
                        </span>
                        {!ec.enabled && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                            }}
                          >
                            Disabled
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>
                          {data?.reward_system === 'cash' ? `$${Number(ec.points).toFixed(2)}` : `+${ec.points} pts`}
                        </span>
                        <span>• Bonus chore pool</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="fas fa-pencil-alt"
                      onClick={() => openEditBonusChoreModal(ec)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon="fas fa-trash-alt"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete Bonus Chore',
                          message: `Are you sure you want to permanently delete "${ec.title}" from the bonus pool?`,
                          confirmText: 'Delete',
                          danger: true,
                        });
                        if (ok) {
                          await apiPost('extra_chores/delete', { id: ec.id });
                          showToast(`Deleted bonus chore "${ec.title}"`);
                          await refresh();
                          await loadSettings();
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
            {(data?.extra_chores || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px', opacity: 0.6 }}>
                No extra bonus chores in pool. Tap &quot;Add Bonus Chore&quot; or &quot;Reset Defaults&quot;!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bonus Chore Add / Edit Modal */}
      {editingBonusChore && (
        <Modal
          open={Boolean(editingBonusChore)}
          onClose={() => setEditingBonusChore(null)}
          title={isNewBonusChore ? 'Add Bonus Chore' : `Edit Bonus Chore: ${editingBonusChore.title || ''}`}
          icon="fas fa-bolt"
          maxWidth={540}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
              <Button variant="ghost" size="sm" onClick={() => setEditingBonusChore(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="fas fa-check"
                loading={savingBonusChore}
                onClick={() => handleSaveBonusChoreModal()}
              >
                {isNewBonusChore ? 'Add to Pool' : 'Save Changes'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
              <Input
                label="Icon"
                type="text"
                placeholder="⚡"
                value={bonusModalIcon}
                onChange={(e) => setBonusModalIcon(e.target.value)}
                style={{ textAlign: 'center', fontSize: '1.2rem' }}
              />
              <Input
                label="Chore Title *"
                placeholder="e.g. Wash the car, Weed garden, Clean oven..."
                value={bonusModalTitle}
                onChange={(e) => setBonusModalTitle(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Input
                label="Points / Value"
                type="number"
                step="0.5"
                min="0.1"
                placeholder="2"
                value={bonusModalPoints}
                onChange={(e) => setBonusModalPoints(e.target.value)}
              />
              <Input
                label="Min Age"
                type="number"
                min="0"
                max="18"
                placeholder="0 (all)"
                value={bonusModalMinAge}
                onChange={(e) => setBonusModalMinAge(e.target.value)}
              />
              <Input
                label="Max Age"
                type="number"
                min="0"
                max="18"
                placeholder="Optional"
                value={bonusModalMaxAge}
                onChange={(e) => setBonusModalMaxAge(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <input
                type="checkbox"
                id="bonusModalEnabledCheckbox"
                checked={bonusModalEnabled}
                onChange={(e) => setBonusModalEnabled(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#f59e0b' }}
              />
              <label htmlFor="bonusModalEnabledCheckbox" style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#e2e8f0' }}>
                Active in extra chores pool (visible to children)
              </label>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. SOUNDS TAB */}
      {tab === 'sounds' && (
        <div className="card" style={{ padding: 24, borderRadius: 18 }}>
          <h3 style={{ marginTop: 0 }}>🔊 Completion Sound Effects</h3>
          <p style={{ opacity: 0.75, fontSize: '0.9rem' }}>
            Upload MP3/WAV clips to play when chores or rewards are completed.
          </p>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                Looking for Sound Themes (Zelda, Christmas, Spooky, Chimes)?
              </div>
              <div style={{ fontSize: '0.78rem', opacity: 0.75 }}>
                Configure procedural sound themes and seasonal event sounds under Seasonal Themes.
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon="fas fa-calendar-star"
              onClick={() => setTab('seasonal')}
            >
              Open Seasonal Themes
            </Button>
          </div>
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
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="fas fa-play"
                    onClick={() => playSound(s.url)}
                  >
                    Play
                  </Button>
                  {s.deletable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="fas fa-trash-alt"
                      onClick={async () => {
                        await apiPost('delete_sound', { filename: s.filename });
                        await loadSettings();
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. DISCORD TAB */}
      {tab === 'discord' && (
        <form onSubmit={handleSaveDiscord} className="card" style={{ padding: 24, borderRadius: 18, maxWidth: 640 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>💬 Discord Webhook Integration</h3>
            {discordWebhookUrl.trim() && (
              <Badge variant="success" size="sm">
                Configured
              </Badge>
            )}
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--cr-text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
            Send real-time alerts to your family Discord server or channel when chores are completed, rewards are redeemed, or new tasks are created.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Discord Webhook URL"
              type="url"
              placeholder="https://discord.com/api/webhooks/1234567890/abcdef..."
              value={discordWebhookUrl}
              onChange={(e) => setDiscordWebhookUrl(e.target.value)}
              helperText="In Discord, right-click any channel &rarr; Edit Channel &rarr; Integrations &rarr; Webhooks &rarr; Copy Webhook URL."
            />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>Notification Triggers</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={discordNotifyChores}
                  onChange={(e) => setDiscordNotifyChores(e.target.checked)}
                />
                Notify on chore completion & new chores assigned
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={discordNotifyRewards}
                  onChange={(e) => setDiscordNotifyRewards(e.target.checked)}
                />
                Notify when rewards are added or redeemed
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Button type="submit" variant="primary" icon="fas fa-save">
                Save Discord Settings
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon="fab fa-discord"
                disabled={!discordWebhookUrl.trim()}
                isLoading={testingDiscord}
                onClick={handleTestDiscord}
              >
                Send Test Webhook
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* 7. GOOGLE CALENDAR TAB */}
      {tab === 'calendar' && (
        <form onSubmit={handleSaveCalendar} className="card" style={{ padding: 24, borderRadius: 18, maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 4px' }}>📅 Google Calendar Integration</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--cr-text-secondary)' }}>
                Sync family events and activities into your Dashboard and Calendar views.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="fas fa-rotate"
              disabled={!calEnabled}
              title={!calEnabled ? 'Enable Calendar Sync below to sync events' : 'Sync latest events from Google'}
              onClick={async () => {
                if (!calEnabled) {
                  showToast('Please enable Google Calendar Sync first', { type: 'error' });
                  return;
                }
                const res = await apiPost<any>('sync_calendar', {});
                if (res?.error) {
                  showToast(`Sync warning: ${res.error}`, { type: 'error' });
                } else {
                  showToast('Calendar synced with Google!');
                }
                await refresh();
              }}
            >
              Sync Now
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormErrorAlert error={calFormError} onDismiss={() => setCalFormError(null)} />

            {/* Master Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: 14,
                background: calEnabled ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                border: calEnabled ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--color-border-subtle)',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--cr-text-primary)' }}>
                  Enable Google Calendar Sync
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--cr-text-secondary)' }}>
                  {calEnabled ? 'Events will be automatically fetched on schedule' : 'Sync is paused. Enable to fetch shared & personal calendars.'}
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26, margin: 0, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={calEnabled}
                  onChange={(e) => setCalEnabled(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: calEnabled ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
                    transition: '.2s',
                    borderRadius: 34,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: "''",
                      height: 20,
                      width: 20,
                      left: calEnabled ? 24 : 3,
                      bottom: 3,
                      backgroundColor: 'white',
                      transition: '.2s',
                      borderRadius: '50%',
                    }}
                  />
                </span>
              </label>
            </div>

            {/* Child Inputs Container (conditionally dimmed / disabled when sync is off) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                opacity: calEnabled ? 1 : 0.45,
                pointerEvents: calEnabled ? 'auto' : 'none',
                transition: 'opacity 0.2s ease',
              }}
            >
              <Input
                label="Whole-Family Shared Calendar (.ics URL)"
                type="url"
                placeholder="https://calendar.google.com/calendar/ical/.../private-.../basic.ics"
                value={calIcalUrl}
                disabled={!calEnabled}
                onChange={(e) => setCalIcalUrl(e.target.value)}
                helperText="Events from this shared family calendar will appear in Gold / Yellow (or mapped to a person if their name is in the event title)."
              />

              <Input
                label="Combined Google Calendar Embed URL (Optional for Iframe View)"
                type="url"
                placeholder="https://calendar.google.com/calendar/embed?src=..."
                value={calEmbedUrl}
                disabled={!calEnabled}
                onChange={(e) => setCalEmbedUrl(e.target.value)}
                helperText="In Google Calendar settings &rarr; 'Integrate calendar', click Customise to select all family sub-calendars together in one single combined embed view."
              />

              {/* Family Members Sub-Calendars Summary */}
              <div
                style={{
                  marginTop: 4,
                  padding: 16,
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                    👨‍👩‍👧‍👦 Individual Family Member Sub-Calendars
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                    Sub-calendars are configured per person so their events appear in their own personal accent colour.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(data?.family || []).map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderLeft: `4px solid ${m.color || '#3b82f6'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img
                          src={resolveAvatarUrl(m.avatar)}
                          alt={m.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                          }}
                          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{m.name}</span>
                        {m.calendar_ical_url ? (
                          <span style={{ fontSize: '0.72rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                            <i className="fas fa-check-circle" /> Connected
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            No personal calendar set
                          </span>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="fas fa-edit"
                        onClick={() => openEditMemberModal(m)}
                      >
                        Edit
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              icon="fas fa-save"
            >
              Save Calendar Settings
            </Button>
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
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon="fas fa-save"
            >
              Save Screensaver Settings
            </Button>
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
            <Input
              label="Notion Integration Token *"
              type="password"
              value={notionToken}
              onChange={(e) => setNotionToken(e.target.value)}
              placeholder="secret_..."
              autoComplete="off"
              helperText="Create an internal integration at notion.so/my-integrations and paste the secret token here."
            />

            <Input
              label="Notion Database ID or URL *"
              type="text"
              value={notionDbId}
              onChange={(e) => setNotionDbId(e.target.value)}
              placeholder="e.g. 1a2b3c4d5e6f... or full Notion database URL"
              helperText="Copy the 32-character ID from your Notion database URL (or paste the entire database URL)."
            />

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
              <Button
                type="button"
                variant="secondary"
                isLoading={testingNotion}
                icon="fas fa-plug"
                onClick={handleTestNotion}
              >
                Test Connection
              </Button>

              <Button
                type="submit"
                variant="primary"
                isLoading={savingNotion}
                icon="fas fa-check"
              >
                Save Notion Settings
              </Button>
            </div>
          </div>
        </form>
      )}
        </div>
      </div>
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
        <Button
          type="button"
          onClick={() => setActiveView('dashboard')}
          variant="primary"
          size="sm"
          icon="fas fa-arrow-left"
        >
          Back to Dashboard
        </Button>
      </div>
      <WipBanner />

      <div className="card" style={{ padding: 20, borderRadius: 16 }}>
        <div style={{ marginBottom: 14, maxWidth: 300 }}>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Activity Types</option>
            <option value="chore_completed">Chore Completed</option>
            <option value="reward_redeemed">Reward Redeemed</option>
            <option value="bonus_points">Bonus Points</option>
            <option value="badge_earned">Badge Earned</option>
          </Select>
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
        <Button
          type="button"
          onClick={() => setActiveView('dashboard')}
          variant="primary"
          size="sm"
          icon="fas fa-arrow-left"
        >
          Back to Dashboard
        </Button>
      </div>
      <WipBanner />

      {historyData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
          {(historyData.leaderboard || []).map((p: any) => (
            <div key={p.id} className="card" style={{ padding: 18, borderRadius: 16, textAlign: 'center' }}>
              <img
                src={resolveAvatarUrl(p.avatar)}
                alt={p.name}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                }}
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
