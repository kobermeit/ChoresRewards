import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { apiGet, apiPost } from '../../../api';
import { Button, Input, Badge } from '../../../components/ui';

export interface NotificationsSettingsTabProps {
  initialDiscord?: any;
  onUpdated?: () => void;
}

export const NotificationsSettingsTab: React.FC<NotificationsSettingsTabProps> = ({
  initialDiscord,
  onUpdated,
}) => {
  const { showToast } = useApp();
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [discordNotifyChores, setDiscordNotifyChores] = useState(true);
  const [discordNotifyRewards, setDiscordNotifyRewards] = useState(true);
  const [testingDiscord, setTestingDiscord] = useState(false);

  useEffect(() => {
    if (initialDiscord) {
      setDiscordWebhookUrl(initialDiscord.webhook_url || '');
      setDiscordNotifyChores(initialDiscord.notify_chores !== false);
      setDiscordNotifyRewards(initialDiscord.notify_rewards !== false);
    } else {
      apiGet<any>('settings_data').then((res) => {
        if (res?.discord) {
          setDiscordWebhookUrl(res.discord.webhook_url || '');
          setDiscordNotifyChores(res.discord.notify_chores !== false);
          setDiscordNotifyRewards(res.discord.notify_rewards !== false);
        }
      }).catch(() => {});
    }
  }, [initialDiscord]);

  const handleSaveDiscord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('save_discord_settings', {
        enabled: Boolean(discordWebhookUrl.trim()),
        webhook_url: discordWebhookUrl.trim(),
        notify_chores: discordNotifyChores,
        notify_rewards: discordNotifyRewards,
      });
      showToast('Saved Discord webhook settings');
      onUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to save Discord settings', { type: 'error' });
    }
  };

  const handleTestDiscord = async () => {
    setTestingDiscord(true);
    try {
      const res = await apiPost<{ success: boolean; message?: string; error?: string }>('test_discord', {
        webhook_url: discordWebhookUrl.trim(),
      });
      if (res.success) {
        showToast(res.message || 'Test message sent to Discord! 🎉', { type: 'success' });
      } else {
        showToast(res.error || 'Failed to send test message', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to connect to Discord', { type: 'error' });
    } finally {
      setTestingDiscord(false);
    }
  };

  return (
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
  );
};

export default NotificationsSettingsTab;
