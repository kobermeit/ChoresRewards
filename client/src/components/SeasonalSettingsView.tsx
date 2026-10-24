import React from 'react';
import {
  useGetSeasonalQuery,
  useUpdateSeasonalSettingsMutation,
  useUpdateSeasonMutation,
  useUpdateSeasonalEventMutation,
  SoundTheme,
} from '../store/api';
import { Button, Select, Card, Badge, FormField } from './ui';
import { playThemedSound } from '../services/soundService';

export const SeasonalSettingsView: React.FC = () => {
  const { data, isLoading } = useGetSeasonalQuery();
  const [updateSettings, { isLoading: isUpdatingSettings }] = useUpdateSeasonalSettingsMutation();
  const [updateSeason] = useUpdateSeasonMutation();
  const [updateEvent] = useUpdateSeasonalEventMutation();

  if (isLoading || !data) {
    return (
      <Card style={{ padding: 24, borderRadius: 18 }}>
        <p style={{ opacity: 0.7, margin: 0 }}>Loading seasonal settings…</p>
      </Card>
    );
  }

  const { settings, seasons, events, active } = data;
  const currentSoundTheme = settings.sound_theme as SoundTheme;

  const handleTestSound = (themeToPlay?: SoundTheme) => {
    const key = (themeToPlay || currentSoundTheme);
    const effective = key === 'auto'
      ? (active.event?.sound_key || active.season?.sound_key || 'default')
      : key;
    playThemedSound(effective, 'chore_done');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header card */}
      <div className="card" style={{ padding: 24, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🍂</span> Seasonal Themes & Sound FX
            </h3>
            <p style={{ opacity: 0.75, fontSize: '0.88rem', margin: '4px 0 0 0' }}>
              Automatically display festive badges, seasonal greetings and themed audio during holidays and seasons.
            </p>
          </div>
          <Badge
            variant={settings.seasonal_themes_enabled ? 'success' : 'neutral'}
            style={{ fontSize: '0.82rem', padding: '4px 10px' }}
          >
            {settings.seasonal_themes_enabled ? 'Seasonal Themes Active' : 'Seasonal Themes Disabled'}
          </Badge>
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
            marginBottom: 20,
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
              Enable Seasonal Themes & Events
            </span>
            <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
              Shows active holiday / season icon in the app header and activates seasonal sound themes.
            </div>
          </div>
        </label>

        {/* Currently Active Banner */}
        {settings.seasonal_themes_enabled && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 14,
              background: active.event ? 'rgba(249, 115, 22, 0.12)' : 'rgba(59, 130, 246, 0.12)',
              border: `1px solid ${active.event ? 'rgba(249, 115, 22, 0.35)' : 'rgba(59, 130, 246, 0.35)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '2rem' }}>
                {active.event?.emoji || active.season?.emoji || '🗓️'}
              </span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc' }}>
                  {active.event ? `Active Event: ${active.event.name}` : active.season ? `Current Season: ${active.season.name}` : 'No active season or event today'}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                  {active.event && active.event.window_start && active.event.window_end
                    ? `Celebration Window: ${active.event.window_start} to ${active.event.window_end}`
                    : active.season
                    ? `Effective Dates: ${active.season.effective_start_md} to ${active.season.effective_end_md}`
                    : 'System defaults in effect'}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon="fas fa-volume-high"
              onClick={() => handleTestSound()}
            >
              Play Theme Sound
            </Button>
          </div>
        )}

        {/* Hemisphere & Sound Theme Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <FormField
            label="Hemisphere"
            help="Determines whether December is Summer (Southern Hemisphere: Australia, NZ) or Winter (Northern Hemisphere: US, Europe)."
          >
            <Select
              value={settings.hemisphere}
              disabled={isUpdatingSettings}
              onChange={(e) => updateSettings({ hemisphere: e.target.value as 'south' | 'north' })}
            >
              <option value="south">Southern Hemisphere (Australia / NZ / South America)</option>
              <option value="north">Northern Hemisphere (North America / Europe / Asia)</option>
            </Select>
          </FormField>

          <FormField
            label="Sound Theme"
            help="Theme for chore completions and timer alerts. 'Auto' dynamically switches to holiday sounds (Halloween spooky, Xmas chimes)."
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Select
                  value={settings.sound_theme}
                  disabled={isUpdatingSettings}
                  onChange={(e) => {
                    const next = e.target.value as SoundTheme;
                    updateSettings({ sound_theme: next });
                    handleTestSound(next);
                  }}
                >
                  <option value="auto">Auto (Syncs with Active Holiday & Season)</option>
                  <option value="default">Default (Pleasant Synth Chime)</option>
                  <option value="fantasy">Fantasy Quest (Zelda Secret Chime)</option>
                  <option value="christmas">Christmas Bells (Celesta & Chimes)</option>
                  <option value="spooky">Spooky Halloween (Theremin Arpeggio)</option>
                  <option value="chimes">Zen Wind Chimes (Soft Pentatonic)</option>
                  <option value="fanfare">Royal Fanfare (Brass Chime)</option>
                </Select>
              </div>
              <Button
                variant="secondary"
                icon="fas fa-play"
                title="Preview sound theme"
                aria-label="Preview sound theme"
                onClick={() => handleTestSound()}
              />
            </div>
          </FormField>
        </div>
      </div>

      {/* Seasonal Events (Easter, Halloween, Christmas, New Year's) */}
      <div className="card" style={{ padding: 24, borderRadius: 18 }}>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#f8fafc' }}>
          🎉 Seasonal Events & Holidays
        </h4>
        <p style={{ opacity: 0.7, fontSize: '0.85rem', margin: '0 0 16px 0' }}>
          Events run for a designated window (typically 1 week before and after the date). Easter is calculated dynamically each year.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map((ev) => (
            <label
              key={ev.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 12,
                background: ev.enabled ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.015)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="checkbox"
                  checked={ev.enabled}
                  onChange={(e) => updateEvent({ id: ev.id, enabled: e.target.checked })}
                  style={{ width: 17, height: 17, accentColor: 'var(--cr-primary)' }}
                />
                <span style={{ fontSize: '1.5rem' }}>{ev.emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: ev.enabled ? '#f8fafc' : '#94a3b8' }}>
                    {ev.name}
                  </div>
                  <div style={{ fontSize: '0.76rem', opacity: 0.65 }}>
                    {ev.rule_type === 'easter'
                      ? `Dynamic Easter calculation (Window: ${ev.window_start || 'Spring'} to ${ev.window_end || 'Easter'})`
                      : `Fixed date (${ev.month_day}, ±${ev.days_before} days)`}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {ev.sound_key && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="fas fa-volume-high"
                    title={`Preview ${ev.sound_key} sound`}
                    onClick={(e) => {
                      e.preventDefault();
                      playThemedSound(ev.sound_key || 'default', 'chore_done');
                    }}
                  />
                )}
                <Badge variant={ev.enabled ? 'success' : 'neutral'}>
                  {ev.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Meteorological Seasons */}
      <div className="card" style={{ padding: 24, borderRadius: 18 }}>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#f8fafc' }}>
          🌱 Meteorological Seasons
        </h4>
        <p style={{ opacity: 0.7, fontSize: '0.85rem', margin: '0 0 16px 0' }}>
          Base seasons apply whenever no holiday event is active. Dates automatically adjust when switching hemispheres.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {seasons.map((s) => (
            <div
              key={s.id}
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: s.enabled ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.015)',
                border: `1px solid ${active.season?.id === s.id ? s.accent || 'var(--cr-primary)' : 'rgba(255, 255, 255, 0.06)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.6rem' }}>{s.emoji}</span>
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
                onChange={(e) => updateSeason({ id: s.id, enabled: e.target.checked })}
                style={{ width: 17, height: 17, accentColor: 'var(--cr-primary)' }}
                aria-label={`Enable ${s.name}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
