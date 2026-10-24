import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { apiGet, apiPost, resolveAssetUrl } from '../../../api';
import { Button } from '../../../components/ui';

export const ScreensaverSettingsTab: React.FC<{ onUpdated?: () => void }> = ({ onUpdated }) => {
  const { showToast } = useApp();
  const [ssConfig, setSsConfig] = useState<any>(null);
  const [ssEnabled, setSsEnabled] = useState(false);
  const [ssIdleMinutes, setSsIdleMinutes] = useState('5');
  const [ssSlideSeconds, setSsSlideSeconds] = useState('15');

  const loadScreensaver = async () => {
    try {
      const ss = await apiGet<any>('screensaver/config');
      if (ss?.success) {
        setSsConfig(ss);
        setSsEnabled(Boolean(ss.enabled));
        setSsIdleMinutes(String(ss.idle_minutes ?? 5));
        setSsSlideSeconds(String(ss.slide_seconds ?? 15));
      }
    } catch {}
  };

  useEffect(() => {
    loadScreensaver();
  }, []);

  const handleSaveScreensaver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('screensaver/config', {
        enabled: ssEnabled,
        idle_minutes: parseInt(ssIdleMinutes, 10) || 5,
        slide_seconds: parseInt(ssSlideSeconds, 10) || 15,
      });
      showToast('Saved screensaver settings');
      onUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to save', { type: 'error' });
    }
  };

  const handleUploadScreensaverMedia = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    for (let i = 0; i < files.length; i++) {
      fd.append('media', files[i]);
    }
    await apiPost('screensaver/upload', fd);
    showToast(`Uploaded ${files.length} screensaver media item(s)`);
    await loadScreensaver();
    onUpdated?.();
  };

  return (
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
              style={{ width: '100%', padding: 8, borderRadius: 8, boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 4 }}>Slide Duration (seconds)</label>
            <input
              type="number"
              min="5"
              value={ssSlideSeconds}
              onChange={(e) => setSsSlideSeconds(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 8, boxSizing: 'border-box' }}
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
                await loadScreensaver();
                onUpdated?.();
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
  );
};

export default ScreensaverSettingsTab;
