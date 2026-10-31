import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { apiGet, apiPost, resolveApiUrl } from '../../../api';
import { Button } from '../../../components/ui';

interface BackupInfo {
  database_bytes: number;
  uploads_files: number;
  uploads_bytes: number;
}

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes < 1) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${index === 0 ? value : value.toFixed(1)} ${units[index]}`;
};

const PING_URL = resolveApiUrl('ping');
const cardStyle: React.CSSProperties = { padding: 24, borderRadius: 18, marginBottom: 20 };

/** Polls the container until it answers again after a restore-triggered restart. */
async function waitForAppBack(timeoutMs = 90000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const res = await fetch(PING_URL, { cache: 'no-store', credentials: 'include' });
      if (res.status === 204 || res.ok) return true;
    } catch {
      // still restarting
    }
  }
  return false;
}

export const BackupSettingsTab: React.FC = () => {
  const { showToast } = useApp();
  const [info, setInfo] = useState<BackupInfo | null>(null);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    apiGet('backup/info', 15000)
      .then((res: any) => {
        if (res?.success) setInfo(res);
      })
      .catch(() => undefined);
  }, []);

  const handleExport = () => {
    setExporting(true);
    try {
      const link = document.createElement('a');
      link.href = resolveApiUrl(`backup/export?media=${includeMedia ? 1 : 0}`);
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('Building your backup — the download starts in a moment.', { type: 'info' });
    } catch {
      showToast('Could not start the backup download', { type: 'error' });
    } finally {
      window.setTimeout(() => setExporting(false), 1500);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) return;
    setRestoring(true);
    setStatus('Uploading and validating the backup…');
    try {
      const form = new FormData();
      form.append('backup', selectedFile);
      const res: any = await apiPost('backup/import', form);
      if (!res?.success) throw new Error(res?.error || 'The backup could not be restored');

      setStatus('Backup restored — the app is restarting with your data…');
      showToast('Backup restored 🎉', { type: 'success' });

      const back = await waitForAppBack();
      if (back) {
        window.location.reload();
        return;
      }
      setStatus(
        'The app did not restart automatically. Press Restart on the container in Coolify, then reload this page.'
      );
      setRestoring(false);
    } catch (err: any) {
      setStatus(null);
      setRestoring(false);
      setConfirming(false);
      showToast(err?.message || 'The backup could not be restored', { type: 'error' });
    }
  };

  return (
    <div>
      <div className="card" style={cardStyle}>
        <h3 style={{ margin: '0 0 6px' }}>📦 Export household backup</h3>
        <p style={{ opacity: 0.75, fontSize: '0.88rem', marginTop: 0 }}>
          Downloads a single <code>.tar.gz</code> containing the SQLite database, the session secret and
          (optionally) every uploaded photo, sound and screensaver file. Restore it here or on another
          server to move the whole household.
        </p>
        <p style={{ fontSize: '0.82rem', opacity: 0.6, margin: '0 0 14px' }}>
          Database {formatBytes(info?.database_bytes || 0)} ·{' '}
          {info
            ? `${info.uploads_files} media file${info.uploads_files === 1 ? '' : 's'} (${formatBytes(
                info.uploads_bytes
              )})`
            : 'media size…'}
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={includeMedia}
            onChange={(e) => setIncludeMedia(e.target.checked)}
            disabled={exporting}
          />
          Include uploaded photos, sounds &amp; screensaver media
        </label>
        <Button variant="primary" icon="fas fa-download" onClick={handleExport} isLoading={exporting}>
          Download backup
        </Button>
      </div>

      <div className="card" style={cardStyle}>
        <h3 style={{ margin: '0 0 6px' }}>♻️ Restore from backup</h3>
        <p style={{ opacity: 0.75, fontSize: '0.88rem', marginTop: 0 }}>
          Replaces the database and uploaded media on this server with the contents of the archive. A
          safety copy of the current database is saved to <code>backups/</code> first, and the app
          restarts automatically afterwards.
        </p>
        <p style={{ fontSize: '0.82rem', opacity: 0.6, margin: '0 0 14px' }}>
          Only backups created by ChoresRewards are accepted — the archive is validated, never executed as
          SQL.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".gz,.tgz,.tar.gz,application/gzip"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            setSelectedFile(file);
            setConfirming(Boolean(file));
            setStatus(null);
          }}
        />

        {!confirming && (
          <Button
            variant="secondary"
            icon="fas fa-folder-open"
            onClick={() => fileInputRef.current?.click()}
            disabled={restoring}
          >
            Choose backup file
          </Button>
        )}

        {confirming && selectedFile && (
          <div>
            <p style={{ fontWeight: 700, margin: '0 0 12px' }}>
              Restore “{selectedFile.name}” ({formatBytes(selectedFile.size)})?
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button
                variant="danger"
                icon="fas fa-triangle-exclamation"
                onClick={handleRestore}
                isLoading={restoring}
              >
                Yes, replace my data
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirming(false);
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                disabled={restoring}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {status && (
          <p style={{ marginTop: 14, marginBottom: 0, fontSize: '0.86rem', opacity: 0.8 }}>{status}</p>
        )}
      </div>
    </div>
  );
};

export default BackupSettingsTab;
