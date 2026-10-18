import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db, BADGE_DEFINITIONS, logActivity, roundPoints } from '../db';
import { UPLOADS_DIR } from '../config';
import { requireAdult, hashPin } from './auth';
import { invalidateGcalCache } from '../services/googleCalendar';
import { calculateAge } from '../utils/people';

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, `${req.params.personId}_${crypto.randomUUID().replace(/-/g, '')}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const peopleRouter = Router();

peopleRouter.get('/api/person_points', (req: Request, res: Response) => {
  const name = String(req.query.name || '').trim();
  if (!name) {
    res.status(400).json({ success: false, error: 'Name is required' });
    return;
  }
  const person = db.prepare('SELECT * FROM person WHERE name = ?').get(name) as any;
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  res.json({
    success: true,
    points: roundPoints(Number(person.points || 0) + Number(person.bonus_points || 0)),
  });
});

peopleRouter.post('/add_person', (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    let names: string[] = [];
    if (Array.isArray(data['people[]'])) {
      names = data['people[]'];
    } else if (Array.isArray(data.people)) {
      names = data.people;
    } else if (data.name) {
      names = [String(data.name)];
    }

    names = names.map((n) => String(n || '').trim()).filter(Boolean);
    if (names.length === 0) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const addedPeople: any[] = [];
    for (const name of names) {
      const existing = db.prepare('SELECT id FROM person WHERE name = ?').get(name);
      if (existing) continue;
      const info = db
        .prepare("INSERT INTO person (name, points, bonus_points, avatar, color, \"order\") VALUES (?, 0, 0, 'default_avatar.png', '#ffffff', 0)")
        .run(name);
      const newPerson = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(info.lastInsertRowid)) as any;
      logActivity('family_member_added', `Family member '${name}' was added`, name);
      addedPeople.push({
        id: newPerson.id,
        name: newPerson.name,
        points: newPerson.points,
        avatar: newPerson.avatar,
        color: newPerson.color,
      });
    }

    res.json({ success: true, people: addedPeople });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

peopleRouter.post('/delete_person', (req: Request, res: Response) => {
  try {
    const personId = Number(req.body?.person_id);
    if (!personId) {
      res.status(400).json({ success: false, error: 'person_id is required' });
      return;
    }
    const person = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as any;
    if (!person) {
      res.status(404).json({ success: false, error: 'Person not found' });
      return;
    }

    db.prepare('DELETE FROM person_streak WHERE person_id = ?').run(personId);
    db.prepare('DELETE FROM person_badge WHERE person_id = ?').run(personId);
    db.prepare('DELETE FROM chore WHERE assigned_to_id = ? OR assigned_to = ?').run(personId, person.name);
    db.prepare('DELETE FROM reward WHERE assigned_to_id = ? OR assigned_to = ?').run(personId, person.name);
    db.prepare('DELETE FROM person WHERE id = ?').run(personId);

    logActivity('family_member_deleted', `Family member '${person.name}' was deleted`, person.name);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

peopleRouter.post('/api/save_person', (req: Request, res: Response) => {
  try {
    const { id, name, dob, age, color, role, pin, calendar_ical_url } = req.body || {};
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    const cleanRole = (role === 'parent' || role === 'family') ? role : 'child';
    const isAdmin = cleanRole === 'parent' ? 1 : 0;
    const cleanColor = String(color || '#ffffff');
    const cleanDob = dob !== undefined ? (String(dob).trim().slice(0, 10) || null) : undefined;
    const cleanAge = age !== undefined && age !== null && age !== '' ? Number(age) : null;
    const cleanIcalUrl = calendar_ical_url !== undefined ? (String(calendar_ical_url).trim() || null) : undefined;

    if (id) {
      const existing = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(id)) as any;
      if (!existing) {
        res.status(404).json({ success: false, error: 'Person not found' });
        return;
      }
      let pinHash = existing.pin;
      if (pin !== undefined) {
        const rawPin = String(pin).trim();
        if (rawPin === '') {
          pinHash = null;
        } else {
          pinHash = hashPin(rawPin);
        }
      }
      const finalDob = cleanDob !== undefined ? cleanDob : existing.dob;
      const finalAge = calculateAge(finalDob, cleanAge !== null ? cleanAge : existing.age);
      const finalIcalUrl = cleanIcalUrl !== undefined ? cleanIcalUrl : existing.calendar_ical_url;

      db.prepare(`
        UPDATE person
        SET name = ?, dob = ?, age = ?, color = ?, role = ?, is_admin = ?, pin = ?, calendar_ical_url = ?
        WHERE id = ?
      `).run(trimmedName, finalDob, finalAge, cleanColor, cleanRole, isAdmin, pinHash, finalIcalUrl, Number(id));

      logActivity('family_member_updated', `Family member '${trimmedName}' details updated`, trimmedName);
      invalidateGcalCache();
      const updated = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(id)) as any;
      if (updated) updated.age = calculateAge(updated.dob, updated.age);
      res.json({ success: true, person: updated });
    } else {
      let pinHash: string | null = null;
      if (pin && String(pin).trim()) {
        pinHash = hashPin(String(pin).trim());
      }
      const finalAge = calculateAge(cleanDob, cleanAge);
      const ins = db.prepare(`
        INSERT INTO person (name, role, points, bonus_points, avatar, color, "order", is_admin, pin, age, dob, calendar_ical_url)
        VALUES (?, ?, 0, 0, 'default_avatar.png', ?, (SELECT COALESCE(MAX("order"), 0) + 1 FROM person), ?, ?, ?, ?, ?)
      `).run(trimmedName, cleanRole, cleanColor, isAdmin, pinHash, finalAge, cleanDob || null, cleanIcalUrl || null);

      const newId = Number(ins.lastInsertRowid);
      db.prepare('INSERT INTO person_streak (person_id, current_streak, longest_streak) VALUES (?, 0, 0)').run(newId);
      logActivity('family_member_added', `Family member '${trimmedName}' was added`, trimmedName);
      invalidateGcalCache();
      const inserted = db.prepare('SELECT * FROM person WHERE id = ?').get(newId) as any;
      if (inserted) inserted.age = calculateAge(inserted.dob, inserted.age);
      res.json({ success: true, person: inserted });
    }
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Failed to save person' });
  }
});

peopleRouter.post(
  '/upload_avatar/:personId',
  avatarUpload.single('avatar'),
  (req: Request, res: Response) => {
    try {
      const personId = Number(req.params.personId);
      const person = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as any;
      if (!person) {
        res.status(404).json({ success: false, error: 'Person not found' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No avatar file uploaded' });
        return;
      }

      if (person.avatar && !String(person.avatar).startsWith('default_')) {
        const oldPath = path.join(UPLOADS_DIR, person.avatar);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch {
            // ignore
          }
        }
      }

      db.prepare('UPDATE person SET avatar = ? WHERE id = ?').run(req.file.filename, personId);
      logActivity('avatar_updated', `Avatar updated for ${person.name}`, person.name);
      res.json({
        success: true,
        avatar: req.file.filename,
        avatar_url: `/static/uploads/${req.file.filename}?v=${Date.now()}`,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  }
);

peopleRouter.post('/save_column_color', (req: Request, res: Response) => {
  const { person_id, color } = req.body || {};
  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(person_id)) as any;
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  db.prepare('UPDATE person SET color = ? WHERE id = ?').run(String(color || '#ffffff'), person.id);
  logActivity('color_updated', `Column color was changed to ${color} for ${person.name}`, person.name);
  res.json({ success: true });
});

peopleRouter.get('/get_column_color/:personId', (req: Request, res: Response) => {
  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(req.params.personId)) as any;
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  res.json({ success: true, color: person.color });
});

peopleRouter.post('/update_order', (req: Request, res: Response) => {
  const { person_id, order } = req.body || {};
  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(person_id)) as any;
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  const newOrder = parseInt(String(order ?? 0), 10) || 0;
  db.prepare('UPDATE person SET "order" = ? WHERE id = ?').run(newOrder, person.id);
  logActivity('order_updated', `Column order was updated to position ${newOrder} for ${person.name}`, person.name);
  res.json({ success: true, message: `Order updated to ${newOrder} for ${person.name}` });
});

peopleRouter.post('/update_person_order', (req: Request, res: Response) => {
  const orderList = req.body?.order;
  if (Array.isArray(orderList)) {
    const stmt = db.prepare('UPDATE person SET "order" = ? WHERE id = ?');
    for (const item of orderList) {
      if (item && item.id !== undefined) {
        stmt.run(Number(item.order || 0), Number(item.id));
      }
    }
  }
  res.json({ success: true });
});

function handleUpdateName(req: Request, res: Response) {
  const { person_id, new_name } = req.body || {};
  const trimmed = String(new_name || '').trim();
  if (!trimmed) {
    res.status(400).json({ success: false, error: 'New name cannot be empty' });
    return;
  }
  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(person_id)) as any;
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  const taken = db.prepare('SELECT id FROM person WHERE id != ? AND name = ?').get(person.id, trimmed);
  if (taken) {
    res.status(400).json({ success: false, error: 'That name is already used by someone else' });
    return;
  }

  const oldName = person.name;
  db.prepare('UPDATE person SET name = ? WHERE id = ?').run(trimmed, person.id);
  if (oldName !== trimmed) {
    db.prepare('UPDATE chore SET assigned_to = ? WHERE assigned_to_id = ? OR assigned_to = ?').run(
      trimmed,
      person.id,
      oldName
    );
    db.prepare('UPDATE reward SET assigned_to = ? WHERE assigned_to_id = ? OR assigned_to = ?').run(
      trimmed,
      person.id,
      oldName
    );
  }

  logActivity('name_updated', `Name was changed from '${oldName}' to '${trimmed}'`, trimmed);
  res.json({ success: true, message: 'Name updated successfully', new_name: trimmed });
}

peopleRouter.post('/update_name', handleUpdateName);
peopleRouter.post('/edit_person_name', handleUpdateName);

peopleRouter.post('/reset_points', requireAdult, (req: Request, res: Response) => {
  const { person_id, new_points } = req.body || {};
  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(person_id)) as any;
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  const parsed = Number(new_points ?? 0);
  if (Number.isNaN(parsed) || parsed < 0) {
    res.status(400).json({ success: false, error: 'Points must be a non-negative number.' });
    return;
  }
  const oldPoints = roundPoints(person.points);
  const rounded = roundPoints(parsed);
  db.prepare('UPDATE person SET points = ?, bonus_points = 0 WHERE id = ?').run(rounded, person.id);
  logActivity(
    'points_reset',
    `Points were reset from ${oldPoints} to ${rounded} for ${person.name} (bonus points also reset)`,
    person.name
  );
  res.json({
    success: true,
    message: `Points for ${person.name} have been set to ${rounded} (bonus points reset to 0)`,
    new_points: rounded,
  });
});

peopleRouter.get('/api/person/:personId/badges', (req: Request, res: Response) => {
  const personId = Number(req.params.personId);
  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as any;
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }

  const earnedRows = db
    .prepare('SELECT badge_key, earned_at FROM person_badge WHERE person_id = ?')
    .all(personId) as Array<{ badge_key: string; earned_at: string }>;
  const earnedMap = new Map(earnedRows.map((r) => [r.badge_key, r.earned_at]));

  const badges = Object.entries(BADGE_DEFINITIONS).map(([key, def]) => ({
    key,
    name: def.name,
    emoji: def.emoji,
    icon: def.emoji,
    desc: def.desc,
    earned: earnedMap.has(key),
    earned_date: earnedMap.get(key) || null,
  }));

  const countRow = db
    .prepare('SELECT COUNT(*) as cnt FROM chore WHERE assigned_to_id = ? AND completed = 1')
    .get(personId) as { cnt: number };

  const streakRow = db.prepare('SELECT * FROM person_streak WHERE person_id = ?').get(personId) as any;

  res.json({
    success: true,
    person: {
      id: person.id,
      name: person.name,
      points: roundPoints(Number(person.points || 0) + Number(person.bonus_points || 0)),
      avatar: person.avatar || 'default_avatar.png',
      color: person.color || '#ffffff',
      age: person.age ?? null,
    },
    streak: {
      current_streak: streakRow?.current_streak || 0,
      longest_streak: streakRow?.longest_streak || 0,
      last_completed_date: streakRow?.last_completed_date || null,
    },
    badges,
    total_completed: countRow?.cnt || 0,
  });
});
