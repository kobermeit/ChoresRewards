import { AppSetting } from '../db';

export async function sendGotifyNotification(title: string, message: string, priority = 5): Promise<boolean> {
  const gotifyUrl = (AppSetting.get('gotify_url', '') || '').trim().replace(/\/+$/, '');
  const gotifyToken = (AppSetting.get('gotify_token', '') || '').trim();
  if (!gotifyUrl || !gotifyToken) return false;

  try {
    const res = await fetch(`${gotifyUrl}/message?token=${encodeURIComponent(gotifyToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, priority }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (err) {
    console.error('[Gotify] Error sending notification:', err);
    return false;
  }
}

export function shouldNotifyPerson(personNameOrId: string | number | null | undefined): boolean {
  const raw = (AppSetting.get('gotify_notify_people', '') || '').trim();
  if (!raw) return true;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true;
  if (personNameOrId === null || personNameOrId === undefined) return true;
  return list.includes(String(personNameOrId));
}
