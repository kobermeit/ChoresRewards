import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { apiGet, apiPost } from '../../../api';
import { Button } from '../../../components/ui';

export interface SoundsSettingsTabProps {
  onNavigateToSeasonal?: () => void;
}

export const SoundsSettingsTab: React.FC<SoundsSettingsTabProps> = ({ onNavigateToSeasonal }) => {
  const { playSound, showToast } = useApp();
  const [sounds, setSounds] = useState<any[]>([]);

  const loadSounds = async () => {
    try {
      const res = await apiGet<any>('settings_data');
      if (res?.sounds) setSounds(res.sounds);
    } catch {}
  };

  useEffect(() => {
    loadSounds();
  }, []);

  return (
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
        {onNavigateToSeasonal && (
          <Button
            size="sm"
            variant="secondary"
            icon="fas fa-calendar-days"
            onClick={onNavigateToSeasonal}
          >
            Open Seasonal Themes
          </Button>
        )}
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
          await loadSounds();
        }}
        style={{ marginBottom: 16 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sounds.map((s: any) => (
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
                    await loadSounds();
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SoundsSettingsTab;
