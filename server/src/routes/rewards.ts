import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { db, AppSetting, logActivity, roundPoints } from '../db';
import { UPLOADS_DIR } from '../config';
import { requireAdult } from './auth';
import { getAppTimezone, getLocalNowNaive, getFamilyToday, formatDateInTz, getConfiguredTimezone } from '../utils/time';
import { sendGotifyNotification } from '../services/gotify';

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
  '/add_reward',
  requireAdult,
  rewardUpload.fields([
    { name: 'reward_image_file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      const title = String(data.title || '').trim();
      const pointsRequired = roundPoints(data.points_required ?? 1);
      const assignedTo = String(data.assigned_to || '').trim();
      const description = data.description ? String(data.description).trim() : null;
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

      const person = db.prepare('SELECT * FROM person WHERE name = ?').get(assignedTo) as any;
      const info = db
        .prepare(
          `INSERT INTO reward (title, points_required, image_url, description, assigned_to_id, assigned_to, completed)
           VALUES (?, ?, ?, ?, ?, ?, 0)`
        )
        .run(title, pointsRequired, finalImageUrl, description, person ? person.id : null, assignedTo);

      logActivity(
        'reward_added',
        `Reward '${title}' (${pointsRequired} pts) was added for ${assignedTo}`,
        assignedTo
      );

      if (AppSetting.get('gotify_notify_rewards_added', 'false') === 'true') {
        sendGotifyNotification(
          'New Reward Added',
          `Reward '${title}' (${pointsRequired} points) was added for ${assignedTo}.`,
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

rewardsRouter.post('/edit_reward', requireAdult, (req: Request, res: Response) => {
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

    const title = data.title !== undefined && String(data.title).trim() ? String(data.title).trim() : reward.title;
    const description = data.description !== undefined ? String(data.description).trim() : reward.description;
    const pointsRequired =
      data.points_required !== undefined ? roundPoints(data.points_required) : reward.points_required;
    const assignedTo =
      data.assigned_to !== undefined && String(data.assigned_to).trim()
        ? String(data.assigned_to).trim()
        : reward.assigned_to;

    const person = db.prepare('SELECT * FROM person WHERE name = ?').get(assignedTo) as any;
    db.prepare(
      'UPDATE reward SET title = ?, description = ?, points_required = ?, assigned_to = ?, assigned_to_id = ? WHERE id = ?'
    ).run(title, description, pointsRequired, assignedTo, person ? person.id : reward.assigned_to_id, rewardId);

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

rewardsRouter.post(
  '/edit_reward_image',
  requireAdult,
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

rewardsRouter.post('/delete_reward', requireAdult, (req: Request, res: Response) => {
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

rewardsRouter.post('/complete_reward', requireAdult, (req: Request, res: Response) => {
  try {
    const { reward_id, assigned_to_id } = req.body || {};
    const reward = db.prepare('SELECT * FROM reward WHERE id = ?').get(Number(reward_id)) as any;
    if (!reward) {
      res.status(404).json({ success: false, error: 'Reward not found' });
      return;
    }
    if (reward.completed) {
      res.status(409).json({ success: false, error: 'This reward was already redeemed' });
      return;
    }

    let person: any = null;
    if (reward.assigned_to_id) {
      person = db.prepare('SELECT * FROM person WHERE id = ?').get(reward.assigned_to_id);
    }
    if (!person && reward.assigned_to) {
      person = db.prepare('SELECT * FROM person WHERE name = ?').get(reward.assigned_to);
    }
    if (!person && assigned_to_id) {
      person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(assigned_to_id));
    }
    if (!person) {
      res.status(404).json({ success: false, error: 'Assigned person not found' });
      return;
    }

    const currentPoints = roundPoints(person.points);
    const requiredPoints = roundPoints(reward.points_required);
    if (currentPoints < requiredPoints) {
      res.status(400).json({ success: false, error: `${person.name} does not have enough points` });
      return;
    }

    const { isoNaive } = getLocalNowNaive(getAppTimezone());
    const claimInfo = db
      .prepare('UPDATE reward SET completed = 1, date_completed = ? WHERE id = ? AND completed = 0')
      .run(isoNaive, reward.id);

    if (claimInfo.changes === 0) {
      res.status(409).json({ success: false, error: 'This reward was already redeemed' });
      return;
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
