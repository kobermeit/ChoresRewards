import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { db, AppSetting, logActivity, roundPoints } from '../db';
import { UPLOADS_DIR } from '../config';
import { requireAdult } from './auth';
import { getAppTimezone, getLocalNowNaive, getFamilyToday, formatDateInTz, getConfiguredTimezone } from '../utils/time';
import { sendGotifyNotification } from '../services/gotify';
import { scrapeRewardUrl, cleanTitle, cleanDescription, decodeEntities } from '../services/scraper';

const rewardUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(UPLOADS_DIR, 'rewards'));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      const safeBase = path
        .basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40);
      cb(null, `${crypto.randomUUID().slice(0, 8)}_${safeBase}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const rewardsRouter = Router();

rewardsRouter.post(
  ['/add_reward', '/rewards/add_reward'],
  rewardUpload.fields([
    { name: 'reward_image_file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      const sourceUrl = data.source_url ? String(data.source_url).trim() : null;
      const sourceName = data.source_name ? String(data.source_name).trim() : null;
      const rawTitle = String(data.title || '').trim();
      const title = sourceUrl ? cleanTitle(rawTitle, sourceName || 'Store') : decodeEntities(rawTitle);
      const pointsRequired = roundPoints(data.points_required ?? 1);
      const assignedTo = String(data.assigned_to || '').trim();
      const description = data.description ? cleanDescription(String(data.description)) : null;
      const imageUrlInput = data.image_url ? String(data.image_url).trim() : null;
      const stockImageUrl = data.stock_image_url ? String(data.stock_image_url).trim() : null;

      if (!title || !assignedTo || pointsRequired <= 0) {
        res.status(400).json({ success: false, error: 'Title, valid points, and Assigned To are required' });
        return;
      }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const uploadedFile = files?.reward_image_file?.[0] || files?.image?.[0];
      let finalImageUrl: string | null = null;
      if (uploadedFile) {
        finalImageUrl = `/static/uploads/rewards/${uploadedFile.filename}`;
      } else if (stockImageUrl) {
        finalImageUrl = stockImageUrl;
      } else if (imageUrlInput) {
        finalImageUrl = imageUrlInput;
      }

      const isEveryone = !assignedTo || assignedTo.toLowerCase() === 'everyone' || assignedTo.toLowerCase() === 'all';
      const person = isEveryone ? null : (db.prepare('SELECT * FROM person WHERE name = ?').get(assignedTo) as any);
      const finalAssignee = isEveryone ? 'Everyone' : (person ? person.name : assignedTo);
      const isRecurring = data.is_recurring === undefined || data.is_recurring === 'true' || data.is_recurring === true || data.is_recurring === 1 || data.is_recurring === '1';

      const info = db
        .prepare(
          `INSERT INTO reward (title, points_required, image_url, description, assigned_to_id, assigned_to, completed, is_recurring, source_url, source_name)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
        )
        .run(title, pointsRequired, finalImageUrl, description, person ? person.id : null, finalAssignee, isRecurring ? 1 : 0, sourceUrl, sourceName);

      logActivity(
        'reward_added',
        `Reward '${title}' (${pointsRequired} pts) was added for ${finalAssignee}`,
        finalAssignee
      );

      if (AppSetting.get('gotify_notify_rewards_added', 'false') === 'true') {
        sendGotifyNotification(
          'New Reward Added',
          `Reward '${title}' (${pointsRequired} points) was added for ${finalAssignee}.`,
          4
        ).catch(() => {});
      }

      const acceptsJson =
        req.is('application/json') ||
        String(req.headers.accept || '').includes('application/json') ||
        req.headers['x-requested-with'] === 'XMLHttpRequest';

      if (acceptsJson) {
        res.json({ success: true, reward_id: Number(info.lastInsertRowid), image_url: finalImageUrl });
      } else {
        res.redirect('./');
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error adding reward' });
    }
  }
);

rewardsRouter.post(
  ['/edit_reward', '/update_reward', '/rewards/edit_reward', '/rewards/update_reward'],
  rewardUpload.fields([
    { name: 'reward_image_file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      const rewardId = Number(data.reward_id ?? data.id);
      if (!rewardId) {
        res.status(400).json({ success: false, error: 'Missing reward_id' });
        return;
      }
      const reward = db.prepare('SELECT * FROM reward WHERE id = ?').get(rewardId) as any;
      if (!reward) {
        res.status(404).json({ success: false, error: 'Reward not found' });
        return;
      }

      const rawTitle = data.title !== undefined && String(data.title).trim() ? String(data.title).trim() : reward.title;
      const sourceUrl = data.source_url !== undefined ? (data.source_url ? String(data.source_url).trim() : null) : reward.source_url;
      const sourceName = data.source_name !== undefined ? (data.source_name ? String(data.source_name).trim() : null) : reward.source_name;
      const title = sourceUrl ? cleanTitle(rawTitle, sourceName || 'Store') : decodeEntities(rawTitle);
      const description = data.description !== undefined ? cleanDescription(String(data.description)) : reward.description;
      const pointsRequired =
        data.points_required !== undefined ? roundPoints(data.points_required) : reward.points_required;
      const rawAssignedTo = data.assigned_to !== undefined ? String(data.assigned_to).trim() : reward.assigned_to;
      const isEveryone = !rawAssignedTo || rawAssignedTo.toLowerCase() === 'everyone' || rawAssignedTo.toLowerCase() === 'all';
      const person = isEveryone ? null : (db.prepare('SELECT * FROM person WHERE name = ?').get(rawAssignedTo) as any);
      const assignedTo = isEveryone ? 'Everyone' : (person ? person.name : rawAssignedTo);
      const isRecurring = data.is_recurring !== undefined
        ? (data.is_recurring === 'true' || data.is_recurring === true || data.is_recurring === 1 || data.is_recurring === '1' ? 1 : 0)
        : (reward.is_recurring !== 0 ? 1 : 0);

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const uploadedFile = files?.reward_image_file?.[0] || files?.image?.[0] || files?.photo?.[0];
      let finalImageUrl = reward.image_url;
      if (uploadedFile) {
        finalImageUrl = `/static/uploads/rewards/${uploadedFile.filename}`;
      } else if (data.image_url !== undefined) {
        finalImageUrl = data.image_url ? String(data.image_url).trim() : null;
      }

      db.prepare(
        'UPDATE reward SET title = ?, description = ?, points_required = ?, assigned_to = ?, assigned_to_id = ?, is_recurring = ?, source_url = ?, source_name = ?, image_url = ? WHERE id = ?'
      ).run(title, description, pointsRequired, assignedTo, person ? person.id : null, isRecurring, sourceUrl, sourceName, finalImageUrl, rewardId);

      res.json({ success: true, reward_id: rewardId, image_url: finalImageUrl });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  }
);

rewardsRouter.post(['/import_url', '/rewards/import_url'], async (req: Request, res: Response) => {
  try {
    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl || !rawUrl.startsWith('http')) {
      res.status(400).json({ success: false, error: 'Valid HTTP/HTTPS URL is required' });
      return;
    }
    const pointValue = parseFloat(AppSetting.get('point_value') || '0.50') || 0.50;
    const scraped = await scrapeRewardUrl(rawUrl, pointValue);
    res.json({ success: true, ...scraped });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error importing reward from URL' });
  }
});

export async function syncRewardById(rewardId: number): Promise<{
  success: boolean;
  reward_id: number;
  old_points: number;
  new_points: number;
  price: number | null;
  points_required: number;
  message: string;
  error?: string;
}> {
  const reward = db.prepare('SELECT * FROM reward WHERE id = ?').get(rewardId) as any;
  if (!reward) {
    throw new Error('Reward not found');
  }
  if (!reward.source_url) {
    throw new Error('Reward does not have an external product URL');
  }

  const pointValue = parseFloat(AppSetting.get('point_value') || '0.50') || 0.50;
  const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);

  try {
    const scraped = await scrapeRewardUrl(reward.source_url, pointValue);
    if (scraped.price && scraped.price > 0) {
      const oldPoints = roundPoints(reward.points_required);
      const newPoints = roundPoints(scraped.points);

      db.prepare(`
        UPDATE reward
        SET points_required = ?,
            last_synced_at = ?,
            sync_error_count = 0,
            source_name = COALESCE(?, source_name),
            title = COALESCE(?, title),
            description = COALESCE(?, description)
        WHERE id = ?
      `).run(newPoints, nowIso, scraped.source_name, scraped.title || null, scraped.description || null, reward.id);

      if (oldPoints !== newPoints) {
        logActivity(
          'reward_updated',
          `Reward '${reward.title}' price refreshed from store ($${scraped.price}): ${oldPoints} → ${newPoints} pts`,
          reward.assigned_to
        );
      }

      return {
        success: true,
        reward_id: reward.id,
        old_points: oldPoints,
        new_points: newPoints,
        price: scraped.price,
        points_required: newPoints,
        message:
          oldPoints !== newPoints
            ? `Points updated: ${oldPoints} → ${newPoints} ($${scraped.price})`
            : `Price confirmed ($${scraped.price} — ${newPoints} pts)`,
      };
    } else {
      // Scraped but no price found
      db.prepare(`
        UPDATE reward
        SET sync_error_count = COALESCE(sync_error_count, 0) + 1,
            last_synced_at = ?
        WHERE id = ?
      `).run(nowIso, reward.id);

      return {
        success: false,
        reward_id: reward.id,
        old_points: roundPoints(reward.points_required),
        new_points: roundPoints(reward.points_required),
        price: null,
        points_required: roundPoints(reward.points_required),
        message: 'Could not extract current price from store page',
        error: 'Price not found on page',
      };
    }
  } catch (err: any) {
    db.prepare(`
      UPDATE reward
      SET sync_error_count = COALESCE(sync_error_count, 0) + 1,
          last_synced_at = ?
      WHERE id = ?
    `).run(nowIso, reward.id);

    throw new Error(err?.message || 'Error fetching store page');
  }
}

export async function runDailyRewardPriceSync(): Promise<{ total: number; updated: number; failed: number }> {
  console.log('[RewardSyncCron] Running daily reward price sync...');
  const rewardsToSync = db
    .prepare(
      `
    SELECT id, title, source_url, sync_error_count
    FROM reward
    WHERE source_url IS NOT NULL
      AND source_url != ''
      AND (completed = 0 OR is_recurring = 1)
      AND (sync_error_count IS NULL OR sync_error_count < 3)
  `
    )
    .all() as Array<{ id: number; title: string; source_url: string; sync_error_count: number }>;

  let updated = 0;
  let failed = 0;

  for (const r of rewardsToSync) {
    try {
      const res = await syncRewardById(r.id);
      if (res.success) {
        if (res.old_points !== res.new_points) updated++;
      } else {
        failed++;
      }
    } catch (err) {
      console.warn(`[RewardSyncCron] Error syncing reward #${r.id} (${r.title}):`, err);
      failed++;
    }
    // Safe throttling delay between store requests (1500ms)
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.log(
    `[RewardSyncCron] Finished daily sync: ${rewardsToSync.length} checked, ${updated} updated, ${failed} failed.`
  );
  return { total: rewardsToSync.length, updated, failed };
}

rewardsRouter.post(['/sync_reward', '/rewards/sync_reward'], async (req: Request, res: Response) => {
  try {
    const rewardId = Number(req.body?.reward_id || req.body?.id);
    if (!rewardId) {
      res.status(400).json({ success: false, error: 'Reward ID is required' });
      return;
    }
    const result = await syncRewardById(rewardId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Failed to sync reward' });
  }
});

rewardsRouter.post(
  '/edit_reward_image',
  rewardUpload.single('image'),
  (req: Request, res: Response) => {
    try {
      const rewardId = Number(req.body?.reward_id);
      if (!rewardId) {
        res.status(400).json({ success: false, error: 'Missing reward_id' });
        return;
      }
      const reward = db.prepare('SELECT * FROM reward WHERE id = ?').get(rewardId) as any;
      if (!reward) {
        res.status(404).json({ success: false, error: 'Reward not found' });
        return;
      }

      let imageUrl: string | null = null;
      if (req.file) {
        imageUrl = `/static/uploads/rewards/${req.file.filename}`;
      } else if (req.body?.image_url) {
        imageUrl = String(req.body.image_url).trim();
      } else {
        res.status(400).json({ success: false, error: 'No image or URL provided' });
        return;
      }

      db.prepare('UPDATE reward SET image_url = ? WHERE id = ?').run(imageUrl, rewardId);
      res.json({ success: true, image_url: imageUrl });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  }
);

rewardsRouter.post(['/delete_reward', '/rewards/delete_reward'], (req: Request, res: Response) => {
  try {
    const rewardId = Number(req.body?.reward_id);
    if (!rewardId) {
      res.status(400).json({ success: false, error: 'Reward ID is required' });
      return;
    }
    const reward = db.prepare('SELECT * FROM reward WHERE id = ?').get(rewardId) as any;
    if (!reward) {
      res.status(404).json({ success: false, error: 'Reward not found' });
      return;
    }
    db.prepare('DELETE FROM reward WHERE id = ?').run(rewardId);
    logActivity('reward_deleted', `Reward '${reward.title}' was deleted`, reward.assigned_to);
    res.json({ success: true, message: 'Reward deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

rewardsRouter.post('/complete_reward', (req: Request, res: Response) => {
  try {
    const { reward_id, assigned_to_id, person_id, person_name } = req.body || {};
    const reward = db.prepare('SELECT * FROM reward WHERE id = ?').get(Number(reward_id)) as any;
    if (!reward) {
      res.status(404).json({ success: false, error: 'Reward not found' });
      return;
    }

    const isRecurring = reward.is_recurring !== 0 && reward.is_recurring !== false;
    if (!isRecurring && reward.completed) {
      res.status(409).json({ success: false, error: 'This one-time reward was already redeemed' });
      return;
    }

    let person: any = null;
    const targetPersonId = person_id || assigned_to_id;
    if (targetPersonId) {
      person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(targetPersonId));
    }
    if (!person && person_name) {
      person = db.prepare('SELECT * FROM person WHERE name = ?').get(String(person_name).trim());
    }
    if (!person && reward.assigned_to_id) {
      person = db.prepare('SELECT * FROM person WHERE id = ?').get(reward.assigned_to_id);
    }
    const isGroupReward = (name: string) => {
      const l = (name || '').toLowerCase();
      return l === 'everyone' || l === 'all' || l === 'kids' || l === 'parents' || l === 'adults';
    };
    if (!person && reward.assigned_to && !isGroupReward(reward.assigned_to)) {
      person = db.prepare('SELECT * FROM person WHERE name = ?').get(reward.assigned_to);
    }
    if (!person) {
      res.status(404).json({ success: false, error: 'Please choose which family member is redeeming this reward' });
      return;
    }

    const currentPoints = roundPoints(person.points);
    const requiredPoints = roundPoints(reward.points_required);
    if (currentPoints < requiredPoints) {
      res.status(400).json({ success: false, error: `${person.name} does not have enough points (${currentPoints} / ${requiredPoints} required)` });
      return;
    }

    const { isoNaive } = getLocalNowNaive(getAppTimezone());

    if (isRecurring) {
      // Create a redemption record in the reward table so it shows in Redeemed Rewards history,
      // while the primary template reward remains completed = 0 in Available Rewards!
      db.prepare(
        `INSERT INTO reward (title, points_required, image_url, description, assigned_to_id, assigned_to, completed, date_completed, is_recurring)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, 1)`
      ).run(reward.title, reward.points_required, reward.image_url, reward.description, person.id, person.name, isoNaive);
    } else {
      const claimInfo = db
        .prepare('UPDATE reward SET completed = 1, date_completed = ?, assigned_to_id = ?, assigned_to = ? WHERE id = ? AND completed = 0')
        .run(isoNaive, person.id, person.name, reward.id);

      if (claimInfo.changes === 0) {
        res.status(409).json({ success: false, error: 'This reward was already redeemed' });
        return;
      }
    }

    const newPoints = roundPoints(currentPoints - requiredPoints);
    db.prepare('UPDATE person SET points = ? WHERE id = ?').run(newPoints, person.id);

    logActivity(
      'reward_redeemed',
      `Reward '${reward.title}' was redeemed for ${reward.points_required} points by ${person.name}`,
      person.name
    );

    if (AppSetting.get('gotify_notify_rewards_redeemed', 'false') === 'true') {
      sendGotifyNotification(
        'Reward Redeemed',
        `Reward '${reward.title}' was redeemed for ${reward.points_required} points by ${person.name}.`,
        4
      ).catch(() => {});
    }

    res.json({
      success: true,
      message: `Reward "${reward.title}" has been completed by ${person.name}`,
      new_points: newPoints,
      assigned_to: person.name,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

rewardsRouter.get('/api/bonus_settings', (_req: Request, res: Response) => {
  res.json({
    bonus_mode: AppSetting.get('bonus_mode', 'static') || 'static',
    bonus_static: AppSetting.get('bonus_static', '10') || '10',
    bonus_min: AppSetting.get('bonus_min', '2') || '2',
    bonus_max: AppSetting.get('bonus_max', '8') || '8',
    bonus_once_per_day: (AppSetting.get('bonus_once_per_day', 'true') || 'true').toLowerCase() === 'true',
  });
});

rewardsRouter.post('/check_bonus_today', (req: Request, res: Response) => {
  const personId = Number(req.body?.person_id);
  const person = personId ? (db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as any) : null;
  const bonusMode = AppSetting.get('bonus_mode', 'static') || 'static';
  const oncePerDay = (AppSetting.get('bonus_once_per_day', 'true') || 'true').toLowerCase() === 'true';
  let awardedToday = false;
  if (person && person.last_bonus_awarded) {
    const today = getFamilyToday();
    const lastDate = String(person.last_bonus_awarded).slice(0, 10);
    awardedToday = lastDate === today;
  }
  res.json({
    bonus_awarded_today: awardedToday,
    bonus_mode: bonusMode,
    bonus_once_per_day: oncePerDay,
  });
});

function handleAwardBonus(req: Request, res: Response) {
  try {
    const { person_id, bonus_points } = req.body || {};
    if (!person_id) {
      res.status(400).json({ success: false, message: 'Missing person_id' });
      return;
    }
    const person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(person_id)) as any;
    if (!person) {
      res.status(404).json({ success: false, message: 'Person not found' });
      return;
    }

    const bonusMode = AppSetting.get('bonus_mode', 'static') || 'static';
    if (bonusMode === 'none') {
      res.status(400).json({ success: false, message: 'Bonus points are disabled.' });
      return;
    }

    const oncePerDay = (AppSetting.get('bonus_once_per_day', 'true') || 'true').toLowerCase() === 'true';
    const today = getFamilyToday();
    if (oncePerDay && person.last_bonus_awarded && String(person.last_bonus_awarded).slice(0, 10) === today) {
      res.status(400).json({
        success: false,
        already_awarded: true,
        message: 'Bonus points already awarded today.',
      });
      return;
    }

    const staticVal = Number(AppSetting.get('bonus_static', '10') || 10);
    const minVal = Number(AppSetting.get('bonus_min', '2') || 2);
    const maxVal = Number(AppSetting.get('bonus_max', '8') || 8);

    let pts = bonus_points !== undefined ? Number(bonus_points) : NaN;
    if (bonusMode === 'static') {
      if (Number.isNaN(pts)) pts = staticVal;
      if (roundPoints(pts) !== roundPoints(staticVal)) {
        res.status(400).json({ success: false, message: 'Invalid static bonus points value.' });
        return;
      }
    } else if (bonusMode === 'range') {
      if (Number.isNaN(pts)) {
        pts = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
      }
      if (pts < minVal || pts > maxVal) {
        res.status(400).json({ success: false, message: 'Bonus points out of allowed range.' });
        return;
      }
    }

    const awarded = roundPoints(pts);
    const newTotal = roundPoints(Number(person.points || 0) + awarded);
    db.prepare('UPDATE person SET points = ?, bonus_points = 0, last_bonus_awarded = ? WHERE id = ?').run(
      newTotal,
      today,
      person.id
    );

    logActivity('bonus_points_awarded', `${awarded} bonus points awarded to ${person.name}`, person.name);

    res.json({
      success: true,
      new_points: newTotal,
      bonus_awarded: awarded,
      bonus_points: awarded,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
}

rewardsRouter.post('/award_bonus_points', handleAwardBonus);
rewardsRouter.post('/award_bonus', handleAwardBonus);

rewardsRouter.post('/log_quiz_result', (req: Request, res: Response) => {
  const { person_id, result } = req.body || {};
  if (!person_id || !result) {
    res.status(400).json({ success: false, message: 'Missing person_id or result' });
    return;
  }
  if (!['correct', 'incorrect', 'skipped'].includes(String(result))) {
    res.status(400).json({ success: false, message: 'Invalid result. Must be correct, incorrect, or skipped' });
    return;
  }
  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(person_id)) as any;
  if (!person) {
    res.status(404).json({ success: false, message: 'Person not found' });
    return;
  }
  const emojis: Record<string, string> = {
    correct: '✅',
    incorrect: '❌',
    skipped: '⏭️',
  };
  logActivity('quiz_completed', `${person.name} ${result} the daily quiz ${emojis[result] || ''}`, person.name);
  res.json({ success: true, message: 'Quiz result logged' });
});
