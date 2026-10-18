import { AppSetting } from '../db';

/**
 * Sends a notification payload to a Discord Webhook.
 * Formats a Discord embed with color, title, and description.
 */
export async function sendDiscordNotification(
  title: string,
  message: string,
  options?: { color?: number; fields?: Array<{ name: string; value: string; inline?: boolean }> }
): Promise<boolean> {
  const webhookUrl = (AppSetting.get('discord_webhook_url', '') || '').trim();
  if (!webhookUrl) return false;

  try {
    const embedColor = options?.color ?? 0x3b82f6; // default primary blue
    const payload = {
      username: 'Chores & Rewards Hub',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/3063/3063823.png',
      embeds: [
        {
          title: `🧹 ${title}`,
          description: message,
          color: embedColor,
          timestamp: new Date().toISOString(),
          fields: options?.fields || [],
          footer: {
            text: 'Family Chores & Rewards',
          },
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    });

    return res.ok;
  } catch (err) {
    console.error('[Discord] Error sending webhook notification:', err);
    return false;
  }
}

/**
 * Backwards compatible alias to seamlessly route all chore/reward alerts to Discord.
 */
export async function sendGotifyNotification(title: string, message: string, priority = 5): Promise<boolean> {
  const color = priority >= 7 ? 0xef4444 : priority >= 5 ? 0x10b981 : 0x3b82f6;
  return sendDiscordNotification(title, message, { color });
}

export function shouldNotifyPerson(personNameOrId: string | number | null | undefined): boolean {
  const raw = (AppSetting.get('discord_notify_people', '') || AppSetting.get('gotify_notify_people', '') || '').trim();
  if (!raw) return true;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true;
  if (personNameOrId === null || personNameOrId === undefined) return true;
  return list.includes(String(personNameOrId));
}
