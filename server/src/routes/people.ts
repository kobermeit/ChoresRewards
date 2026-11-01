import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { and, eq, ne, or, sql } from 'drizzle-orm';
import { BADGE_DEFINITIONS, logActivity, roundPoints } from '../db';
import { getDb, many, one } from '../db/client';
import {
  chore as choreTable,
  person as personTable,
  personBadge,
  personStreak,
  reward as rewardTable,
} from '../db/schema';
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

peopleRouter.get('/api/person_points', async (req: Request, res: Response) => {
  const name = String(req.query.name || '').trim();
  if (!name) {
    res.status(400).json({ success: false, error: 'Name is required' });
    return;
  }
  const person = await one(getDb().select().from(personTable).where(eq(personTable.name, name)).limit(1));
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  res.json({
    success: true,
    points: roundPoints(Number(person.points || 0) + Number(person.bonus_points || 0)),
  });
});

peopleRouter.post('/add_person', async (req: Request, res: Response) => {
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
      const existing = await one(getDb().select({ id: personTable.id }).from(personTable).where(eq(personTable.name, name)).limit(1));
      if (existing) continue;
      const [newPerson] = await getDb()
        .insert(personTable)
        .values({ name, points: 0, bonusPoints: 0, avatar: 'default_avatar.png', color: '#ffffff', order: 0 })
        .returning();
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

peopleRouter.post('/delete_person', async (req: Request, res: Response) => {
  try {
    const personId = Number(req.body?.person_id);
    if (!personId) {
      res.status(400).json({ success: false, error: 'person_id is required' });
      return;
    }
    const person = await one(getDb().select().from(personTable).where(eq(personTable.id, personId)).limit(1));
    if (!person) {
      res.status(404).json({ success: false, error: 'Person not found' });
      return;
    }

    const db = getDb();
    await db.delete(personStreak).where(eq(personStreak.personId, personId));
    await db.delete(personBadge).where(eq(personBadge.personId, personId));
    await db
      .delete(choreTable)
      .where(or(eq(choreTable.assignedToId, personId), eq(choreTable.assignedTo, person.name)));
    await db
      .delete(rewardTable)
      .where(or(eq(rewardTable.assignedToId, personId), eq(rewardTable.assignedTo, person.name)));
    await db.delete(personTable).where(eq(personTable.id, personId));

    logActivity('family_member_deleted', `Family member '${person.name}' was deleted`, person.name);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

peopleRouter.post('/api/save_person', async (req: Request, res: Response) => {
  try {
    const { id, name, dob, age, color, role, pin, clear_pin, calendar_ical_url } = req.body || {};
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    const cleanRole = (role === 'parent' || role === 'family') ? role : 'child';
    const isAdmin = cleanRole === 'parent';
    const cleanColor = String(color || '#ffffff');
    const cleanDob = dob !== undefined ? (String(dob).trim().slice(0, 10) || null) : undefined;
    const cleanAge = age !== undefined && age !== null && age !== '' ? Number(age) : null;
    const cleanIcalUrl = calendar_ical_url !== undefined ? (String(calendar_ical_url).trim() || null) : undefined;

    if (id) {
      const existing = await one(getDb().select().from(personTable).where(eq(personTable.id, Number(id))).limit(1));
      if (!existing) {
        res.status(404).json({ success: false, error: 'Person not found' });
        return;
      }
      let pinHash = existing.pin;
      if (clear_pin === true || clear_pin === 'true' || pin === null) {
        pinHash = null;
      } else if (pin !== undefined && String(pin).trim() !== '') {
        const rawPin = String(pin).trim();
        pinHash = hashPin(rawPin);
      }
      const finalDob = cleanDob !== undefined ? cleanDob : existing.dob;
      const finalAge = calculateAge(finalDob, cleanAge !== null ? cleanAge : existing.age);
      const finalIcalUrl = cleanIcalUrl !== undefined ? cleanIcalUrl : existing.calendar_ical_url;

      await getDb()
        .update(personTable)
        .set({
          name: trimmedName,
          dob: finalDob ?? null,
          age: finalAge,
          color: cleanColor,
          role: cleanRole,
          isAdmin,
          pin: pinHash,
          calendarIcalUrl: finalIcalUrl ?? null,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(personTable.id, Number(id)));

      logActivity('family_member_updated', `Family member '${trimmedName}' details updated`, trimmedName);
      invalidateGcalCache();
      const updated = await one(getDb().select().from(personTable).where(eq(personTable.id, Number(id))).limit(1));
      if (updated) updated.age = calculateAge(updated.dob, updated.age);
      res.json({ success: true, person: updated });
    } else {
      let pinHash: string | null = null;
      if (pin && String(pin).trim()) {
        pinHash = hashPin(String(pin).trim());
      }
      const finalAge = calculateAge(cleanDob, cleanAge);
      const [ins] = await getDb()
        .insert(personTable)
        .values({
          name: trimmedName,
          role: cleanRole,
          points: 0,
          bonusPoints: 0,
          avatar: 'default_avatar.png',
          color: cleanColor,
          order: sql<number>`(SELECT COALESCE(MAX("order"), 0) + 1 FROM person)`,
          isAdmin,
          pin: pinHash,
          age: finalAge,
          dob: cleanDob || null,
          calendarIcalUrl: cleanIcalUrl || null,
        })
        .returning({ id: personTable.id });

      const newId = ins.id;
      await getDb().insert(personStreak).values({ personId: newId, currentStreak: 0, longestStreak: 0 });
      logActivity('family_member_added', `Family member '${trimmedName}' was added`, trimmedName);
      invalidateGcalCache();
      const inserted = await one(getDb().select().from(personTable).where(eq(personTable.id, newId)).limit(1));
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
  async (req: Request, res: Response) => {
    try {
      const personId = Number(req.params.personId);
      const person = await one(getDb().select().from(personTable).where(eq(personTable.id, personId)).limit(1));
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

      await getDb().update(personTable).set({ avatar: req.file.filename }).where(eq(personTable.id, personId));
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

peopleRouter.post('/save_column_color', async (req: Request, res: Response) => {
  const { person_id, color } = req.body || {};
  const person = await one(getDb().select().from(personTable).where(eq(personTable.id, Number(person_id))).limit(1));
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  await getDb().update(personTable).set({ color: String(color || '#ffffff') }).where(eq(personTable.id, person.id));
  logActivity('color_updated', `Column color was changed to ${color} for ${person.name}`, person.name);
  res.json({ success: true });
});

peopleRouter.get('/get_column_color/:personId', async (req: Request, res: Response) => {
  const person = await one(getDb().select().from(personTable).where(eq(personTable.id, Number(req.params.personId))).limit(1));
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  res.json({ success: true, color: person.color });
});

peopleRouter.post('/update_order', async (req: Request, res: Response) => {
  const { person_id, order } = req.body || {};
  const person = await one(getDb().select().from(personTable).where(eq(personTable.id, Number(person_id))).limit(1));
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  const newOrder = parseInt(String(order ?? 0), 10) || 0;
  await getDb().update(personTable).set({ order: newOrder }).where(eq(personTable.id, person.id));
  logActivity('order_updated', `Column order was updated to position ${newOrder} for ${person.name}`, person.name);
  res.json({ success: true, message: `Order updated to ${newOrder} for ${person.name}` });
});

peopleRouter.post('/update_person_order', async (req: Request, res: Response) => {
  const orderList = req.body?.order;
  if (Array.isArray(orderList)) {
    const db = getDb();
    for (const item of orderList) {
      if (item && item.id !== undefined) {
        await db
          .update(personTable)
          .set({ order: Number(item.order || 0) })
          .where(eq(personTable.id, Number(item.id)));
      }
    }
  }
  res.json({ success: true });
});

async function handleUpdateName(req: Request, res: Response) {
  const { person_id, new_name } = req.body || {};
  const trimmed = String(new_name || '').trim();
  if (!trimmed) {
    res.status(400).json({ success: false, error: 'New name cannot be empty' });
    return;
  }
  const person = await one(getDb().select().from(personTable).where(eq(personTable.id, Number(person_id))).limit(1));
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  const taken = await one(
    getDb()
      .select({ id: personTable.id })
      .from(personTable)
      .where(and(ne(personTable.id, person.id), eq(personTable.name, trimmed)))
      .limit(1)
  );
  if (taken) {
    res.status(400).json({ success: false, error: 'That name is already used by someone else' });
    return;
  }

  const oldName = person.name;
  const db = getDb();
  await db.update(personTable).set({ name: trimmed }).where(eq(personTable.id, person.id));
  if (oldName !== trimmed) {
    const choreMatch = or(eq(choreTable.assignedToId, person.id), eq(choreTable.assignedTo, oldName));
    await db.update(choreTable).set({ assignedTo: trimmed }).where(choreMatch);
    const rewardMatch = or(eq(rewardTable.assignedToId, person.id), eq(rewardTable.assignedTo, oldName));
    await db.update(rewardTable).set({ assignedTo: trimmed }).where(rewardMatch);
  }

  logActivity('name_updated', `Name was changed from '${oldName}' to '${trimmed}'`, trimmed);
  res.json({ success: true, message: 'Name updated successfully', new_name: trimmed });
}

peopleRouter.post('/update_name', handleUpdateName);
peopleRouter.post('/edit_person_name', handleUpdateName);

peopleRouter.post('/reset_points', requireAdult, async (req: Request, res: Response) => {
  const { person_id, new_points } = req.body || {};
  const person = await one(getDb().select().from(personTable).where(eq(personTable.id, Number(person_id))).limit(1));
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
  await getDb().update(personTable).set({ points: rounded, bonusPoints: 0 }).where(eq(personTable.id, person.id));
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

peopleRouter.get('/api/person/:personId/badges', async (req: Request, res: Response) => {
  const personId = Number(req.params.personId);
  const person = await one(getDb().select().from(personTable).where(eq(personTable.id, personId)).limit(1));
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }

  const earnedRows = await many<{ badge_key: string; earned_at: string }>(
    getDb()
      .select({ badge_key: personBadge.badgeKey, earned_at: personBadge.earnedAt })
      .from(personBadge)
      .where(eq(personBadge.personId, personId))
  );
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

  const countRow = await one<{ cnt: number }>(
    getDb()
      .select({ cnt: sql<number>`COUNT(*)::int` })
      .from(choreTable)
      .where(and(eq(choreTable.assignedToId, personId), eq(choreTable.completed, true)))
  );

  const streakRow = await one(
    getDb().select().from(personStreak).where(eq(personStreak.personId, personId)).limit(1)
  );

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
