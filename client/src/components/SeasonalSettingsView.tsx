import React, { useState } from 'react';
import {
  useGetSeasonalQuery,
  useUpdateSeasonalSettingsMutation,
  useUpdateSeasonMutation,
  useUpdateSeasonalEventMutation,
  SoundTheme,
} from '../store/api';
import { Button, Select, Card, Badge, FormField, TimerDurationSelect } from './ui';
import { playThemedSound } from '../services/soundService';
import { useUiPref } from '../hooks/useSettings';

export const SeasonalSettingsView: React.FC = () => {
  const { data, isLoading } = useGetSeasonalQuery();
  const [updateSettings, { isLoading: isUpdatingSettings }] = useUpdateSeasonalSettingsMutation();
  const [updateSeason] = useUpdateSeasonMutation();
  const [updateEvent] = useUpdateSeasonalEventMutation();
  const [expandedEventKey, setExpandedEventKey] = useState<string | null>('christmas');
  const [seasonalCharacters, setSeasonalCharacters] = useUiPref('seasonalCharacters');
  const [seasonalScene, setSeasonalScene] = useUiPref('seasonalScene');
  const [snowDensity, setSnowDensity] = useUiPref('snowDensity');
  const [seasonalCalmMode, setSeasonalCalmMode] = useUiPref('seasonalCalmMode');
  const [ambientIdleEnabled, setAmbientIdleEnabled] = useUiPref('ambientIdleEnabled');
  const [ambientIdleMinutes, setAmbientIdleMinutes] = useUiPref('ambientIdleMinutes');
  const [screensaverMinutes, setScreensaverMinutes] = useUiPref('screensaverMinutes');

  if (isLoading || !data) {
    return (
      <Card style={{ padding: 24, borderRadius: 18 }}>
        <p style={{ opacity: 0.7, margin: 0 }}>Loading seasonal settings…</p>
      </Card>
    );
  }

  const { settings, seasons, events, active } = data;
  const forcedTheme = settings.forced_theme || '';

  const getSoundForTheme = (themeKey: string): SoundTheme => {
    if (themeKey === 'christmas' || themeKey === 'winter') return 'christmas';
    if (themeKey === 'halloween') return 'spooky';
    if (themeKey === 'easter' || themeKey === 'spring' || themeKey === 'autumn') return 'chimes';
    if (themeKey === 'new_year') return 'fanfare';
    return (active.event?.sound_key || active.season?.sound_key || 'default') as SoundTheme;
  };

  const handleTestSound = (themeToPlay?: SoundTheme) => {
    const key = themeToPlay || getSoundForTheme(forcedTheme);
    const effective = key === 'auto'
      ? (active.event?.sound_key || active.season?.sound_key || 'default')
      : key;
    playThemedSound(effective, 'chore_done');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', minWidth: 0 }}>
      {/* Header card */}
      <div className="card" style={{ padding: 24, borderRadius: 18, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🍂</span> Seasonal Themes &amp; Audio
            </h3>
            <p style={{ opacity: 0.75, fontSize: '0.88rem', margin: '4px 0 0 0' }}>
              Automatically display festive badges, seasonal watermarks, accents, and themed audio during holidays and seasons.
            </p>
          </div>
          <Badge
            variant={settings.seasonal_themes_enabled ? 'success' : 'neutral'}
            style={{ fontSize: '0.82rem', padding: '4px 10px' }}
          >
            {settings.seasonal_themes_enabled ? 'Seasonal Themes Active' : 'Seasonal Themes Disabled'}
          </Badge>
        </div>

        {/* Seasonal characters (per-device display preference) */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: settings.seasonal_themes_enabled ? 'pointer' : 'not-allowed',
            opacity: settings.seasonal_themes_enabled ? 1 : 0.55,
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 16,
          }}
        >
          <input
            type="checkbox"
            checked={seasonalCharacters}
            disabled={!settings.seasonal_themes_enabled}
            onChange={(e) => setSeasonalCharacters(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--cr-primary)' }}
          />
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
              Show Seasonal Characters
            </span>
            <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
              Animated characters in the screen gutters (Jack, Sally, Zero &amp; co. during Halloween).
              Device-only setting. Custom art: <code>static/images/characters/&lt;theme&gt;/</code>
            </div>
          </div>
        </label>


        {/* Seasonal Scene & Living Backdrop (per-device preferences) */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: settings.seasonal_themes_enabled ? 'pointer' : 'not-allowed',
              opacity: settings.seasonal_themes_enabled ? 1 : 0.55,
            }}
          >
            <input
              type="checkbox"
              checked={seasonalScene}
              disabled={!settings.seasonal_themes_enabled}
              onChange={(e) => setSeasonalScene(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--cr-primary)' }}
            />
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                Show Living Christmas Scene
              </span>
              <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
                Living holiday background on the Today screen (snow, stars, aurora, village, and Santa).
              </div>
            </div>
          </label>

          {seasonalScene && settings.seasonal_themes_enabled && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                paddingLeft: 28,
                paddingTop: 4,
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, opacity: 0.85 }}>Snow Density:</span>
                <select
                  value={snowDensity}
                  onChange={(e) => setSnowDensity(Number(e.target.value))}
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    color: '#f8fafc',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: '0.8rem',
                  }}
                >
                  <option value={1}>Low (1.0×)</option>
                  <option value={1.5}>Medium (1.5×)</option>
                  <option value={2}>High (2.0× - Recommended)</option>
                </select>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  opacity: 0.85,
                }}
              >
                <input
                  type="checkbox"
                  checked={seasonalCalmMode}
                  onChange={(e) => setSeasonalCalmMode(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--cr-primary)' }}
                />
                <span>Calm Mode (no Santa flight, no pointer parallax)</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  opacity: 0.85,
                }}
              >
                <input
                  type="checkbox"
                  checked={ambientIdleEnabled}
                  onChange={(e) => setAmbientIdleEnabled(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--cr-primary)' }}
                />
                <span>Idle Mode (dim the UI when idle, then play the living scene)</span>
              </label>

              {ambientIdleEnabled && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 24 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, opacity: 0.85 }}>Dim after:</span>
                    <TimerDurationSelect
                      value={ambientIdleMinutes}
                      onChange={(val) => setAmbientIdleMinutes(val)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 24 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, opacity: 0.85 }}>Screensaver after:</span>
                    <select
                      value={screensaverMinutes}
                      onChange={(e) => setScreensaverMinutes(Number(e.target.value))}
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        color: '#f8fafc',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: 6,
                        padding: '3px 8px',
                        fontSize: '0.8rem',
                      }}
                    >
                      {[1, 2, 3, 5, 10, 15, 30].map((m) => (
                        <option key={m} value={m}>
                          {m} min
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Master Toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 16,
          }}
        >
          <input
            type="checkbox"
            checked={settings.seasonal_themes_enabled}
            disabled={isUpdatingSettings}
            onChange={(e) => updateSettings({ seasonal_themes_enabled: e.target.checked })}
            style={{ width: 18, height: 18, accentColor: 'var(--cr-primary)' }}
          />
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
              Enable Seasonal Themes &amp; Events
            </span>
            <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
              Shows active holiday / season icon in the app header, tints accents, and activates seasonal visual &amp; audio themes.
            </div>
          </div>
        </label>

        {/* Currently Active Banner */}
        {settings.seasonal_themes_enabled && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 14,
              background: (active.event?.key === 'christmas' ? '#ef44441f' : (active.event?.accent ? active.event.accent + '1f' : (active.season?.accent ? active.season.accent + '1f' : 'rgba(255, 255, 255, 0.04)'))),
              border: `1px solid ${active.event?.key === 'christmas' ? '#ef444455' : (active.event?.accent ? active.event.accent + '55' : (active.season?.accent ? active.season.accent + '55' : 'rgba(255, 255, 255, 0.08)'))}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>
                {(active.event?.key === 'christmas' ? '🎅' : active.event?.emoji) || active.season?.emoji || '🗓️'}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>{active.event ? `Active Event: ${active.event.name}` : active.season ? `Current Season: ${active.season.name}` : 'No active season or event today'}</span>
                  {forcedTheme && (
                    <Badge variant="warning" style={{ fontSize: '0.7rem' }}>
                      MANUAL OVERRIDE
                    </Badge>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: 2 }}>
                  {forcedTheme
                    ? 'Simulated theme. Visual watermarks and audio synthesis are locked to this theme.'
                    : active.event && active.event.window_start && active.event.window_end
                    ? `Celebration Window: ${active.event.window_start} to ${active.event.window_end}`
                    : active.season
                    ? `Effective Dates: ${active.season.effective_start_md} to ${active.season.effective_end_md}`
                    : 'System defaults in effect'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {forcedTheme && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => updateSettings({ forced_theme: '', sound_theme: 'auto' })}
                >
                  Reset to Auto
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                icon="fas fa-volume-high"
                onClick={() => handleTestSound()}
              >
                Play Theme Sound
              </Button>
            </div>
          </div>
        )}

        {/* Unified 2-Column Responsive Grid: Theme & Hemisphere */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* 1. Unified Theme Selector (Controls Visual + Audio together) */}
          <FormField
            label="Theme"
            help="Select a theme to style visual watermarks, header emblems, accents, and sound effects."
          >
            <div style={{ display: 'flex', gap: 8, width: '100%', minWidth: 0, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Select
                  value={forcedTheme}
                  disabled={isUpdatingSettings || !settings.seasonal_themes_enabled}
                  onChange={(e) => {
                    const next = e.target.value;
                    updateSettings({ forced_theme: next, sound_theme: 'auto' });
                    const soundToPlay = getSoundForTheme(next);
                    handleTestSound(soundToPlay);
                  }}
                >
                  <option value="">🗓️ Automatic (Follows Calendar &amp; Seasons)</option>
                  <option value="christmas">🎄 Christmas (Winter Wonderland)</option>
                  <option value="halloween">🎃 Halloween (Spooky Season)</option>
                  <option value="easter">🐰 Easter (Spring Celebration)</option>
                  <option value="new_year">🎆 New Year&apos;s Day (Royal Fanfare)</option>
                  <option value="spring">🌸 Spring Season</option>
                  <option value="summer">☀️ Summer Season</option>
                  <option value="autumn">🍂 Autumn Season</option>
                  <option value="winter">❄️ Winter Season</option>
                </Select>
              </div>
              <Button
                variant="secondary"
                icon="fas fa-play"
                title="Preview theme sound"
                aria-label="Preview theme sound"
                disabled={!settings.seasonal_themes_enabled}
                style={{ flexShrink: 0 }}
                onClick={() => handleTestSound()}
              />
            </div>
          </FormField>

          {/* 2. Hemisphere */}
          <FormField
            label="Hemisphere"
            help="Southern (Australia/NZ: Dec is Summer) vs Northern (US/Europe: Dec is Winter)."
          >
            <Select
              value={settings.hemisphere}
              disabled={isUpdatingSettings || !settings.seasonal_themes_enabled}
              onChange={(e) => updateSettings({ hemisphere: e.target.value as 'south' | 'north' })}
            >
              <option value="south">Southern Hemisphere (Australia / NZ / South America)</option>
              <option value="north">Northern Hemisphere (North America / Europe / Asia)</option>
            </Select>
          </FormField>
        </div>
      </div>

      {/* Seasonal Events (Easter, Halloween, Christmas, New Year's) */}
      <div className="card" style={{ padding: 24, borderRadius: 18, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#f8fafc' }}>
          🎉 Seasonal Events &amp; Holidays
        </h4>
        <p style={{ opacity: 0.7, fontSize: '0.85rem', margin: '0 0 16px 0' }}>
          Events activate automatically based on designated calendar dates (Halloween: Oct 24 – Nov 1, Easter: 1 week prior through Easter Monday, Christmas: Dec 1 – Dec 26, New Year&apos;s: Dec 31 – Jan 1).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', minWidth: 0 }}>
          {events.map((ev) => {
            const hasSubSettings = ev.key === 'christmas';
            const isExpanded = expandedEventKey === ev.key;
            const isEventDisabled = !ev.enabled || !settings.seasonal_themes_enabled;

            return (
              <div
                key={ev.id}
                style={{
                  borderRadius: 14,
                  background: ev.enabled && settings.seasonal_themes_enabled ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.015)',
                  border: `1px solid ${ev.enabled && settings.seasonal_themes_enabled ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)'}`,
                  padding: '12px 16px',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      minWidth: 0,
                      flex: 1,
                      cursor: settings.seasonal_themes_enabled ? 'pointer' : 'not-allowed',
                      opacity: settings.seasonal_themes_enabled ? 1 : 0.6,
                      margin: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={ev.enabled}
                      disabled={!settings.seasonal_themes_enabled || isUpdatingSettings}
                      onChange={(e) => updateEvent({ id: ev.id, enabled: e.target.checked })}
                      style={{ width: 17, height: 17, accentColor: 'var(--cr-primary)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{ev.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: ev.enabled && settings.seasonal_themes_enabled ? '#f8fafc' : '#94a3b8' }}>
                        {ev.name}
                      </div>
                      <div style={{ fontSize: '0.76rem', opacity: 0.65 }}>
                        {ev.window_start && ev.window_end
                          ? `Active window: ${ev.window_start} to ${ev.window_end}`
                          : ev.rule_type === 'easter'
                          ? 'Dynamic Easter calculation'
                          : `Fixed date (${ev.month_day})`}
                      </div>
                    </div>
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {ev.sound_key && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="fas fa-volume-high"
                        title={`Preview ${ev.sound_key} sound`}
                        disabled={!settings.seasonal_themes_enabled}
                        onClick={() => playThemedSound(ev.sound_key || 'default', 'chore_done')}
                      />
                    )}
                    {hasSubSettings && (
                      <Button
                        size="sm"
                        variant={isExpanded && !isEventDisabled ? 'secondary' : 'ghost'}
                        icon={isExpanded && !isEventDisabled ? 'fas fa-chevron-up' : 'fas fa-chevron-down'}
                        disabled={isEventDisabled}
                        title={isEventDisabled ? 'Enable this theme to configure options' : isExpanded ? 'Collapse options' : 'Expand options'}
                        onClick={() => setExpandedEventKey(isExpanded ? null : ev.key)}
                        style={{ fontSize: '0.82rem' }}
                      >
                        Options
                      </Button>
                    )}
                    <Badge variant={ev.enabled && settings.seasonal_themes_enabled ? 'success' : 'neutral'}>
                      {ev.enabled && settings.seasonal_themes_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>

                {/* Sub-settings (only expandable and active when parent theme is enabled) */}
                {hasSubSettings && isExpanded && !isEventDisabled && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Christmas Theme Options
                    </div>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: isEventDisabled ? 'not-allowed' : 'pointer',
                        margin: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={settings.falling_snow_enabled ?? true}
                        disabled={isEventDisabled || isUpdatingSettings}
                        onChange={(e) => updateSettings({ falling_snow_enabled: e.target.checked })}
                        style={{ width: 17, height: 17, accentColor: 'var(--cr-primary)', cursor: 'pointer' }}
                      />
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f8fafc' }}>
                          ❄️ Light Falling Snow (Winter &amp; Christmas)
                        </span>
                        <div style={{ fontSize: '0.76rem', opacity: 0.7 }}>
                          Gentle, GPU-accelerated snowfall effect during winter &amp; Christmas events. Automatically disabled on mobile screens (&lt; 768px).
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Meteorological Seasons */}
      <div className="card" style={{ padding: 24, borderRadius: 18, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#f8fafc' }}>
          🌱 Meteorological Seasons
        </h4>
        <p style={{ opacity: 0.7, fontSize: '0.85rem', margin: '0 0 16px 0' }}>
          Base seasons apply whenever no holiday event is active. Dates automatically adjust when switching hemispheres.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, width: '100%', minWidth: 0 }}>
          {seasons.map((s) => (
            <div
              key={s.id}
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: s.enabled && settings.seasonal_themes_enabled ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.015)',
                border: `1px solid ${active.season?.id === s.id ? s.accent || 'var(--cr-primary)' : 'rgba(255, 255, 255, 0.06)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: settings.seasonal_themes_enabled ? 1 : 0.6 }}>
                <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{s.emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                    {s.name}
                    {active.season?.id === s.id && (
                      <span style={{ fontSize: '0.72rem', color: s.accent || 'var(--cr-primary)', marginLeft: 6, fontWeight: 800 }}>
                        (Current)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', opacity: 0.65 }}>
                    {s.effective_start_md} – {s.effective_end_md}
                  </div>
                </div>
              </div>

              <input
                type="checkbox"
                checked={s.enabled}
                disabled={!settings.seasonal_themes_enabled || isUpdatingSettings}
                onChange={(e) => updateSeason({ id: s.id, enabled: e.target.checked })}
                style={{ width: 17, height: 17, accentColor: 'var(--cr-primary)', cursor: settings.seasonal_themes_enabled ? 'pointer' : 'not-allowed' }}
                aria-label={`Enable ${s.name}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
