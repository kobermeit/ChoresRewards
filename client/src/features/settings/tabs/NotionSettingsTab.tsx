import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { apiGet, apiPost } from '../../../api';
import { Button, Input } from '../../../components/ui';

export const NotionSettingsTab: React.FC<{ onUpdated?: () => void }> = ({ onUpdated }) => {
  const { refresh, showToast } = useApp();
  const [notionToken, setNotionToken] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [notionStatus, setNotionStatus] = useState<{ configured: boolean; message?: string } | null>(null);
  const [testingNotion, setTestingNotion] = useState(false);
  const [savingNotion, setSavingNotion] = useState(false);

  useEffect(() => {
    apiGet<any>('settings/notion').then((nRes) => {
      if (nRes?.success) {
        setNotionDbId(nRes.database_id || '');
        setNotionStatus({ configured: Boolean(nRes.configured) });
      }
    }).catch(() => {});
  }, []);

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
        onUpdated?.();
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

  return (
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
  );
};

export default NotionSettingsTab;
