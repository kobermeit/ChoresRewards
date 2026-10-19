import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db, AppSetting, logActivity, roundPoints } from '../db';
import { UPLOADS_DIR } from '../config';
import { requireAuth, requireAdult } from './auth';
import { getAppTimezone, getFamilyToday, getLocalNowNaive, addDays, isChoreOverdue } from '../utils/time';
import {
  calculateWeeklyProgress,
  checkAndAwardBadges,
  getExtraChores,
  getExtrasForPerson,
  getPersonAgeValue,
  extraMatchesAge,
} from '../services/chores';
import { sendGotifyNotification, shouldNotifyPerson } from '../services/gotify';

const CHORES_UPLOAD_DIR = path.join(UPLOADS_DIR, 'chores');
if (!fs.existsSync(CHORES_UPLOAD_DIR)) {
  fs.mkdirSync(CHORES_UPLOAD_DIR, { recursive: true });
}

const choreUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, CHORES_UPLOAD_DIR);
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
const formParser = multer();

function formFlagIsTrue(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') return ['on', 'true', '1', 'yes'].includes(val.trim().toLowerCase());
  return false;
}

function personForAssignment(assignedToId?: number | null, assignedTo?: string | null): any | null {
  if (assignedToId) {
    const p = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(assignedToId));
    if (p) return p;
  }
  if (assignedTo) {
    const p = db.prepare('SELECT * FROM person WHERE name = ?').get(String(assignedTo).trim());
    if (p) return p;
  }
  return null;
}

export const choresRouter = Router();

choresRouter.get('/get_chores', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM chore WHERE deleted = 0 ORDER BY due_date, id').all() as Array<any>;
  const chores = rows.map((c) => ({
    id: c.id,
    title: c.title,
    assigned_to_id: c.assigned_to_id,
    assigned_to: c.assigned_to,
    points: c.points,
    completed: Boolean(c.completed),
    is_daily: Boolean(c.is_daily),
    days_of_week: c.days_of_week ? String(c.days_of_week).split(',').filter(Boolean) : [],
    due_date: c.due_date || null,
    due_datetime: c.due_datetime || null,
    date_completed: c.date_completed || null,
    icon: c.icon || null,
    image_url: c.image_url || null,
    is_extra: Boolean(c.is_extra),
    extra_id: c.extra_id || null,
  }));
  res.json({ success: true, chores });
});

choresRouter.post(
  '/add_chore',
  choreUpload.fields([
    { name: 'chore_image_file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  requireAdult,
  (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      const title = String(data.title || '').trim();
      const assignedTo = String(data.assigned_to || '').trim();
      const points = Math.max(0, roundPoints(data.points ?? 1));
      let isDaily = formFlagIsTrue(data.is_daily);
      const dueDatetimeRaw = String(data.due_datetime || '').trim();
      const icon = data.icon ? String(data.icon).trim().slice(0, 20) : null;

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const uploadedFile = files?.chore_image_file?.[0] || files?.image?.[0];
      let imageUrl: string | null = null;
      if (uploadedFile) {
        imageUrl = `/static/uploads/chores/${uploadedFile.filename}`;
      } else if (data.image_url) {
        imageUrl = String(data.image_url).trim();
      }

      let daysOfWeekRaw = data.days_of_week ?? data['days_of_week[]'] ?? [];
      if (typeof daysOfWeekRaw === 'string') {
        daysOfWeekRaw = daysOfWeekRaw.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      const cleanedDays: string[] = Array.isArray(daysOfWeekRaw)
        ? daysOfWeekRaw.map((d: any) => String(d).trim().toLowerCase()).filter(Boolean)
        : [];

      if (!title || !assignedTo) {
        res.json({ success: false, error: 'Title and Assigned To are required fields.' });
        return;
      }

      const person = db.prepare('SELECT * FROM person WHERE name = ?').get(assignedTo) as any;
      if (!person) {
        res.json({ success: false, error: 'Assigned person not found.' });
        return;
      }

      let daysOfWeekStr: string | null = null;
      if (cleanedDays.length > 0) {
        daysOfWeekStr = cleanedDays.join(',');
        isDaily = true;
      }

      let dueDatetime: string | null = null;
      let dueDate: string | null = null;
      if (dueDatetimeRaw) {
        dueDatetime = dueDatetimeRaw.replace('T', ' ').slice(0, 19);
        dueDate = dueDatetime.slice(0, 10);
      } else if (isDaily) {
        dueDate = getFamilyToday();
      }

      const durationSeconds = data.duration_seconds !== undefined && data.duration_seconds !== '' && data.duration_seconds !== null
        ? Math.max(10, parseInt(String(data.duration_seconds), 10) || 0)
        : null;

      const info = db
        .prepare(
          `INSERT INTO chore (title, assigned_to_id, assigned_to, points, completed, is_daily, days_of_week, due_date, due_datetime, deleted, icon, image_url, is_extra, extra_id, duration_seconds)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
        )
        .run(
          title,
          person.id,
          person.name,
          points,
          isDaily ? 1 : 0,
          daysOfWeekStr,
          dueDate,
          dueDatetime,
          icon,
          imageUrl,
          formFlagIsTrue(data.is_extra) ? 1 : 0,
          data.extra_id ? String(data.extra_id).slice(0, 32) : null,
          durationSeconds
        );

      logActivity('chore_added', `Chore '${title}' was added for ${person.name} (${points} pts)`, person.name);

      const notifyNew = AppSetting.get('gotify_notify_new_chore', 'true') === 'true';
      if (notifyNew && (shouldNotifyPerson(person.name) || shouldNotifyPerson(person.id))) {
        sendGotifyNotification('New Chore Added', `Chore '${title}' was assigned to ${person.name} (${points} points).`).catch(() => {});
      }

      res.json({
        success: true,
        chore_id: Number(info.lastInsertRowid),
        is_daily: isDaily,
        image_url: imageUrl,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Error adding chore' });
    }
  }
);

choresRouter.post(
  '/edit_chore',
  choreUpload.fields([
    { name: 'chore_image_file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  requireAdult,
  (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      const choreId = Number(data.chore_id ?? data.id);
      const title = String(data.title || '').trim();
      const assignedTo = String(data.assigned_to || '').trim();
      const points = Math.max(0, roundPoints(data.points ?? 1));

      if (!choreId || !title || !assignedTo) {
        res.status(400).json({ success: false, error: 'Missing required fields' });
        return;
      }

      const chore = db.prepare('SELECT * FROM chore WHERE id = ?').get(choreId) as any;
      if (!chore) {
        res.status(404).json({ success: false, error: 'Chore not found' });
        return;
      }

      const person = db.prepare('SELECT * FROM person WHERE name = ?').get(assignedTo) as any;
      const assignedToId = person ? person.id : null;

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const uploadedFile = files?.chore_image_file?.[0] || files?.image?.[0];
      let imageUrl = chore.image_url;
      if (uploadedFile) {
        imageUrl = `/static/uploads/chores/${uploadedFile.filename}`;
      } else if (formFlagIsTrue(data.remove_image)) {
        imageUrl = null;
      } else if ('image_url' in data) {
        imageUrl = data.image_url ? String(data.image_url).trim() : null;
      }

      let daysRaw = data.days_of_week ?? data['days_of_week[]'] ?? [];
      if (typeof daysRaw === 'string') {
        daysRaw = daysRaw.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      const cleanedDays: string[] = Array.isArray(daysRaw)
        ? daysRaw.map((d: any) => String(d).trim().toLowerCase()).filter(Boolean)
        : [];

      let isDaily = Boolean(chore.is_daily);
      let daysOfWeek: string | null = null;
      if (cleanedDays.length > 0) {
        daysOfWeek = cleanedDays.join(',');
        isDaily = true;
      } else if ('is_daily' in data) {
        isDaily = formFlagIsTrue(data.is_daily);
      } else {
        isDaily = false;
      }

      const dueDatetimeRaw = 'due_datetime' in data ? String(data.due_datetime || '').trim() : null;
      let dueDatetime = chore.due_datetime;
      let dueDate = chore.due_date;
      if (dueDatetimeRaw !== null) {
        if (dueDatetimeRaw) {
          dueDatetime = dueDatetimeRaw.replace('T', ' ').slice(0, 19);
          dueDate = dueDatetime.slice(0, 10);
        } else {
          dueDatetime = null;
          dueDate = isDaily ? getFamilyToday() : null;
        }
      }

      const icon = 'icon' in data ? (data.icon ? String(data.icon).trim().slice(0, 20) : null) : chore.icon;
      const durationSeconds = 'duration_seconds' in data
        ? data.duration_seconds !== '' && data.duration_seconds !== null && data.duration_seconds !== undefined
          ? Math.max(10, parseInt(String(data.duration_seconds), 10) || 0)
          : null
        : chore.duration_seconds;

      db.prepare(
        `UPDATE chore SET title = ?, assigned_to = ?, assigned_to_id = ?, points = ?, days_of_week = ?, is_daily = ?, icon = ?, image_url = ?, due_date = ?, due_datetime = ?, duration_seconds = ? WHERE id = ?`
      ).run(title, assignedTo, assignedToId, points, daysOfWeek, isDaily ? 1 : 0, icon, imageUrl, dueDate, dueDatetime, durationSeconds, choreId);

      logActivity('chore_edited', `Chore '${title}' was edited for ${assignedTo}`, assignedTo);
      res.json({
        success: true,
        is_daily: isDaily,
        days_of_week: daysOfWeek || '',
        image_url: imageUrl,
        duration_seconds: durationSeconds,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Error editing chore' });
    }
  }
);

choresRouter.post('/delete_chore', requireAdult, (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const choreId = Number(data.chore_id);
    const permanent = formFlagIsTrue(data.permanent);
    if (!choreId) {
      res.status(400).json({ success: false, error: 'Chore ID is required' });
      return;
    }
    const chore = db.prepare('SELECT * FROM chore WHERE id = ?').get(choreId) as any;
    if (!chore) {
      res.status(404).json({ success: false, error: 'Chore not found' });
      return;
    }

    let message = '';
    if (chore.is_daily) {
      if (permanent) {
        db.prepare('UPDATE chore SET deleted = 1 WHERE id = ?').run(choreId);
        logActivity('daily_chore_deleted', `Daily chore '${chore.title}' was permanently deleted`, chore.assigned_to);
        message = `Daily chore '${chore.title}' has been permanently deleted`;
      } else {
        const tomorrow = addDays(getFamilyToday(), 1);
        db.prepare('UPDATE chore SET due_date = ?, completed = 0 WHERE id = ?').run(tomorrow, choreId);
        logActivity('daily_chore_skipped', `Daily chore '${chore.title}' skipped for today`, chore.assigned_to);
        message = `Daily chore '${chore.title}' removed for today and will return tomorrow`;
      }
    } else {
      db.prepare('DELETE FROM chore WHERE id = ?').run(choreId);
      logActivity('chore_deleted', `Chore '${chore.title}' was deleted`, chore.assigned_to);
      message = `Chore '${chore.title}' deleted successfully`;
    }

    res.json({ success: true, message, chore_id: choreId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error deleting chore' });
  }
});

choresRouter.post('/add_daily_chore', formParser.none(), requireAdult, (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const title = String(data.title || '').trim();
    const assignedTo = String(data.assigned_to || '').trim();
    const points = Math.max(0, roundPoints(data.points ?? 1));
    if (!title || !assignedTo) {
      res.status(400).json({ success: false, error: 'Title and Assigned To are required' });
      return;
    }
    const person = db.prepare('SELECT * FROM person WHERE name = ?').get(assignedTo) as any;
    const today = getFamilyToday();
    const info = db
      .prepare(
        'INSERT INTO chore (title, assigned_to_id, assigned_to, points, is_daily, due_date, completed, deleted) VALUES (?, ?, ?, ?, 1, ?, 0, 0)'
      )
      .run(title, person ? person.id : null, assignedTo, points, today);

    logActivity('daily_chore_added', `Daily chore '${title}' added for ${assignedTo}`, assignedTo);
    const progress = calculateWeeklyProgress(assignedTo);
    res.json({
      success: true,
      chore_id: Number(info.lastInsertRowid),
      progress,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

choresRouter.post('/edit_daily_chore', requireAdult, (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const choreId = Number(data.chore_id);
    const chore = db.prepare('SELECT * FROM chore WHERE id = ? AND is_daily = 1').get(choreId) as any;
    if (!chore) {
      res.status(404).json({ success: false, error: 'Daily chore not found' });
      return;
    }
    const title = String(data.title || chore.title).trim();
    const assignedTo = String(data.assigned_to || chore.assigned_to).trim();
    const points = Math.max(0, roundPoints(data.points ?? chore.points));
    const person = db.prepare('SELECT * FROM person WHERE name = ?').get(assignedTo) as any;
    const daysRaw = Array.isArray(data.days_of_week) ? data.days_of_week : [];
    const cleanedDays = daysRaw.map((d: any) => String(d).trim().toLowerCase()).filter(Boolean);

    db.prepare(
      'UPDATE chore SET title = ?, assigned_to = ?, assigned_to_id = ?, points = ?, days_of_week = ?, is_daily = 1 WHERE id = ?'
    ).run(title, assignedTo, person ? person.id : null, points, cleanedDays.length ? cleanedDays.join(',') : null, choreId);

    logActivity('daily_chore_edited', `Daily chore '${title}' was edited for ${assignedTo}`, assignedTo);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

choresRouter.post('/delete_daily_chore', requireAdult, (req: Request, res: Response) => {
  const choreId = Number(req.body?.chore_id);
  if (!choreId) {
    res.status(400).json({ success: false, error: 'Chore ID is required' });
    return;
  }
  const chore = db.prepare('SELECT * FROM chore WHERE id = ?').get(choreId) as any;
  if (!chore) {
    res.status(404).json({ success: false, error: 'Chore not found' });
    return;
  }
  if (!chore.is_daily) {
    res.status(400).json({ success: false, error: 'This endpoint is only for daily chores' });
    return;
  }
  db.prepare('UPDATE chore SET deleted = 1 WHERE id = ?').run(choreId);
  logActivity('daily_chore_deleted', `Daily chore '${chore.title}' was permanently deleted for ${chore.assigned_to}`, chore.assigned_to);
  res.json({
    success: true,
    message: `Daily chore '${chore.title}' has been permanently deleted`,
    chore_id: choreId,
  });
});

choresRouter.post('/complete_chore', requireAuth, (req: Request, res: Response) => {
  try {
    const choreId = Number(req.body?.chore_id);
    const chore = db.prepare('SELECT * FROM chore WHERE id = ?').get(choreId) as any;
    if (!chore) {
      res.status(404).json({ success: false, error: 'Chore not found' });
      return;
    }
    if (chore.completed) {
      res.status(409).json({ success: false, already_completed: true, error: 'This chore is already completed' });
      return;
    }

    const tz = getAppTimezone();
    const { isoNaive, dateStr, hour, weekdayLower } = getLocalNowNaive(tz);
    const person = personForAssignment(chore.assigned_to_id, chore.assigned_to);
    const assignedName = person ? person.name : chore.assigned_to;

    db.prepare('UPDATE chore SET completed = 1, date_completed = ?, assigned_to = ? WHERE id = ?').run(
      isoNaive,
      assignedName,
      choreId
    );

    let pointsAwarded = 0;
    const bonusAwarded = 0;
    let overdue = false;
    let newBadges: Array<any> = [];
    let currentStreak = 0;
    let newPoints = 0;

    if (person) {
      overdue = isChoreOverdue(chore, isoNaive);
      if (!overdue) {
        pointsAwarded = roundPoints(chore.points);
        const updatedPts = roundPoints(Number(person.points || 0) + pointsAwarded);
        db.prepare('UPDATE person SET points = ? WHERE id = ?').run(updatedPts, person.id);
        newPoints = roundPoints(updatedPts + Number(person.bonus_points || 0));

        if (req.session) {
          req.session.celebrate_person = assignedName;
          req.session.celebrate_avatar = person.avatar || 'default_avatar.png';
        }

        logActivity(
          'chore_completed',
          `Chore '${chore.title}' was completed and ${pointsAwarded} points were awarded`,
          assignedName
        );

        const notifyCompleted = AppSetting.get('gotify_notify_chores_completed', 'false') === 'true';
        if (notifyCompleted && (shouldNotifyPerson(person.id) || shouldNotifyPerson(assignedName))) {
          sendGotifyNotification(
            'Chore Completed',
            `Chore '${chore.title}' was completed by ${assignedName}. ${pointsAwarded} points awarded.`
          ).catch(() => {});
        }

        const badgeRes = checkAndAwardBadges(person.id, dateStr, hour, weekdayLower);
        newBadges = badgeRes.newBadges;
        currentStreak = badgeRes.currentStreak;
      } else {
        newPoints = roundPoints(Number(person.points || 0) + Number(person.bonus_points || 0));
        logActivity(
          'chore_completed',
          `Chore '${chore.title}' was completed but was overdue. No points awarded.`,
          assignedName
        );
      }
    }

    const progress = calculateWeeklyProgress(assignedName);

    res.json({
      success: true,
      assigned_to: assignedName,
      chore_title: chore.title,
      progress,
      new_points: newPoints,
      points_awarded: pointsAwarded,
      bonus_awarded: bonusAwarded,
      overdue,
      new_badges: newBadges,
      newly_awarded_badges: newBadges,
      current_streak: currentStreak,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Error completing chore' });
  }
});

choresRouter.post('/undo_complete_chore', requireAuth, (req: Request, res: Response) => {
  try {
    const choreId = Number(req.body?.chore_id);
    const chore = db.prepare('SELECT * FROM chore WHERE id = ?').get(choreId) as any;
    if (!chore) {
      res.status(404).json({ success: false, error: 'Chore not found' });
      return;
    }
    if (!chore.completed) {
      res.status(400).json({ success: false, error: 'Chore is not completed' });
      return;
    }

    const awardedPoints = chore.date_completed ? !isChoreOverdue(chore, String(chore.date_completed)) : true;
    const person = personForAssignment(chore.assigned_to_id, chore.assigned_to);
    const assignedName = person ? person.name : chore.assigned_to;

    db.prepare('UPDATE chore SET completed = 0, date_completed = NULL, assigned_to = ? WHERE id = ?').run(
      assignedName,
      choreId
    );

    let newPoints = 0;
    if (person && awardedPoints) {
      const updatedPts = roundPoints(Math.max(0, Number(person.points || 0) - Number(chore.points || 0)));
      db.prepare('UPDATE person SET points = ? WHERE id = ?').run(updatedPts, person.id);
      newPoints = roundPoints(updatedPts + Number(person.bonus_points || 0));
      logActivity(
        'chore_undone',
        `Chore '${chore.title}' was undone and ${chore.points} points were deducted`,
        assignedName
      );
    } else if (person) {
      newPoints = roundPoints(Number(person.points || 0) + Number(person.bonus_points || 0));
      logActivity(
        'chore_undone',
        `Chore '${chore.title}' was undone. No points were deducted because it was completed overdue.`,
        assignedName
      );
    }

    const progress = calculateWeeklyProgress(assignedName);
    res.json({
      success: true,
      assigned_to: assignedName,
      chore_id: chore.id,
      chore_title: chore.title,
      new_points: newPoints,
      progress,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Error undoing chore' });
  }
});

choresRouter.post('/clear_completed_chores', requireAdult, (req: Request, res: Response) => {
  try {
    const personId = req.body?.person_id ? Number(req.body.person_id) : null;
    if (personId) {
      const person = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as any;
      if (person) {
        // Delete non-daily completed chores for this person
        const info = db
          .prepare('DELETE FROM chore WHERE (assigned_to_id = ? OR assigned_to = ?) AND completed = 1 AND is_daily = 0')
          .run(person.id, person.name);
        res.json({ success: true, deleted_count: info.changes });
        return;
      }
    }
    const info = db.prepare('DELETE FROM chore WHERE completed = 1 AND is_daily = 0').run();
    res.json({ success: true, deleted_count: info.changes });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

choresRouter.get('/completed_chores_fragment', (_req: Request, res: Response) => {
  const today = getFamilyToday();
  const completedChores = db
    .prepare('SELECT * FROM chore WHERE completed = 1 AND date_completed IS NOT NULL AND date_completed >= ?')
    .all(today) as Array<any>;
  res.json({ success: true, chores: completedChores });
});

choresRouter.get('/api/extra_chores', requireAuth, (req: Request, res: Response) => {
  const personIdRaw = req.query.person_id;
  if (personIdRaw !== undefined && personIdRaw !== '') {
    const person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(personIdRaw)) as any;
    if (!person) {
      res.status(404).json({ success: false, error: 'Person not found' });
      return;
    }
    const extras = getExtrasForPerson(person);
    res.json({ success: true, extras, chores: extras, person_age: person.age ?? null });
    return;
  }
  const allExtras = getExtraChores();
  res.json({ success: true, extras: allExtras, chores: allExtras });
});

choresRouter.post('/api/extra_chores/claim', requireAuth, (req: Request, res: Response) => {
  const { extra_id, person_id } = req.body || {};
  if (!extra_id || !person_id) {
    res.status(400).json({ success: false, error: 'extra_id and person_id are required' });
    return;
  }
  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(person_id)) as any;
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  const extra = getExtraChores().find((e) => e.id === String(extra_id) && e.enabled);
  if (!extra) {
    res.status(404).json({ success: false, error: 'Extra chore not found' });
    return;
  }
  if (!extraMatchesAge(extra, getPersonAgeValue(person))) {
    res.status(403).json({ success: false, error: 'Extra chore not available for this age' });
    return;
  }

  const openExtras = db
    .prepare('SELECT * FROM chore WHERE assigned_to_id = ? AND is_extra = 1 AND completed = 0 AND deleted = 0')
    .all(person.id) as Array<any>;

  if (openExtras.some((c) => c.extra_id === extra.id)) {
    res.status(409).json({ success: false, error: 'That extra is already on their list' });
    return;
  }
  if (openExtras.length >= 3) {
    res.status(400).json({ success: false, error: 'Finish an extra first — max 3 at a time' });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO chore (title, assigned_to_id, assigned_to, points, completed, is_daily, deleted, icon, is_extra, extra_id)
       VALUES (?, ?, ?, ?, 0, 0, 0, ?, 1, ?)`
    )
    .run(extra.title, person.id, person.name, extra.points, extra.icon || null, extra.id);

  logActivity('chore_added', `Extra chore '${extra.title}' claimed by ${person.name}`, person.name);

  res.json({
    success: true,
    chore_id: Number(info.lastInsertRowid),
    title: extra.title,
    points: extra.points,
    icon: extra.icon || '',
    assigned_to: person.name,
    person_id: person.id,
    is_extra: true,
    extra_id: extra.id,
  });
});
