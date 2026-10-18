import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { db, AppSetting, BADGE_DEFINITIONS, logActivity, roundPoints } from '../db';
import { UPLOADS_DIR, APP_VERSION } from '../config';
import { hashPin } from './auth';
import { getAppTimezone, getMondayOfWeek, isChoreOverdue } from '../utils/time';
import { ensureDailyReset, getExtraChores, loadQuizQuestions } from '../services/chores';
import {
  getWeekDaysList,
  getMealPlanForWeek,
  getMealSuggestions,
  getMealIngredients,
  getMealImages,
  getMealSocial,
  getAllRecipes,
  getShoppingStores,
  getShoppingData,
  getShoppingIntelligence,
  getNotesKanban,
  getTextPads,
  getDashboardNotes,
} from './household';
import { getGoogleCalendarData } from '../services/googleCalendar';
import { calculateAge, getBirthdayInfo, buildHouseholdGroups } from '../utils/people';

const setupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, `setup_${crypto.randomUUID().replace(/-/g, '')}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const stateRouter = Router();

stateRouter.get('/api/bootstrap', async (req: Request, res: Response) => {
  try {
    const familyToday = ensureDailyReset();
    const peopleRows = db.prepare('SELECT * FROM person ORDER BY "order", id').all() as Array<any>;
    const needsSetup = peopleRows.length === 0;

    const choresRows = db
      .prepare('SELECT * FROM chore WHERE deleted = 0 AND (is_daily = 0 OR due_date IS NULL OR due_date <= ?) ORDER BY due_date, id')
      .all(familyToday) as Array<any>;

    const overdueChoreIds: number[] = [];
    const chores = choresRows.map((c) => {
      const overdue = Boolean(c.due_datetime && !c.completed && isChoreOverdue(c));
      if (overdue) overdueChoreIds.push(c.id);
      return {
        id: c.id,
        title: c.title,
        assigned_to_id: c.assigned_to_id,
        assigned_to: c.assigned_to,
        points: roundPoints(c.points),
        completed: Boolean(c.completed),
        date_completed: c.date_completed || null,
        is_daily: Boolean(c.is_daily),
        days_of_week: c.days_of_week || null,
        due_date: c.due_date || null,
        due_datetime: c.due_datetime || null,
        deleted: Boolean(c.deleted),
        icon: c.icon || null,
        is_extra: Boolean(c.is_extra),
        extra_id: c.extra_id || null,
        is_overdue: overdue,
      };
    });

    const rewardsRows = db.prepare('SELECT * FROM reward ORDER BY id').all() as Array<any>;
    const rewards = rewardsRows.map((r) => ({
      id: r.id,
      title: r.title,
      points_required: roundPoints(r.points_required),
      image_url: r.image_url || null,
      description: r.description || null,
      assigned_to_id: r.assigned_to_id,
      assigned_to: r.assigned_to,
      completed: Boolean(r.completed),
      date_completed: r.date_completed || null,
      is_recurring: r.is_recurring !== 0 && r.is_recurring !== false,
    }));

    const weekStart = getMondayOfWeek(familyToday);

    const familyProgress: Record<string, { completed: number; total: number }> = {};
    for (const p of peopleRows) {
      const personChores = chores.filter((c) => c.assigned_to === p.name && !c.deleted);
      const completedCnt = personChores.filter((c) => c.completed).length;
      familyProgress[p.name] = { completed: completedCnt, total: personChores.length };
    }

    const streaksRows = db.prepare('SELECT * FROM person_streak').all() as Array<any>;
    const personStreaks: Record<number, { current_streak: number; longest_streak: number; last_completed_date: string | null }> = {};
    for (const s of streaksRows) {
      personStreaks[s.person_id] = {
        current_streak: s.current_streak || 0,
        longest_streak: s.longest_streak || 0,
        last_completed_date: s.last_completed_date || null,
      };
    }

    const badgesRows = db.prepare('SELECT * FROM person_badge ORDER BY earned_at').all() as Array<any>;
    const personBadges: Record<number, Array<{ key: string; emoji: string; name: string; desc: string }>> = {};
    const personEarnedKeys: Record<string, string[]> = {};
    for (const b of badgesRows) {
      const def = BADGE_DEFINITIONS[b.badge_key];
      if (!def) continue;
      if (!personBadges[b.person_id]) personBadges[b.person_id] = [];
      personBadges[b.person_id].push({
        key: b.badge_key,
        emoji: def.emoji,
        name: def.name,
        desc: def.desc,
      });
      const pidStr = String(b.person_id);
      if (!personEarnedKeys[pidStr]) personEarnedKeys[pidStr] = [];
      personEarnedKeys[pidStr].push(b.badge_key);
    }

    const totalCompletedRows = db
      .prepare(
        'SELECT assigned_to_id, COUNT(id) as cnt FROM chore WHERE completed = 1 AND assigned_to_id IS NOT NULL GROUP BY assigned_to_id'
      )
      .all() as Array<{ assigned_to_id: number; cnt: number }>;
    const personTotalCompleted: Record<string, number> = {};
    for (const row of totalCompletedRows) {
      personTotalCompleted[String(row.assigned_to_id)] = row.cnt;
    }

    const personAges: Record<string, number> = {};
    const realPeopleRows = peopleRows.filter((p) => p.role !== 'family');
    const kioskRow = peopleRows.find((p) => p.role === 'family') || null;

    const family = realPeopleRows.map((p) => {
      const dynamicAge = calculateAge(p.dob, p.age);
      if (dynamicAge !== null) {
        personAges[String(p.id)] = dynamicAge;
      }
      return {
        id: p.id,
        name: p.name,
        points: roundPoints(p.points),
        bonus_points: roundPoints(p.bonus_points),
        avatar: p.avatar || 'default_avatar.png',
        color: p.color || '#ffffff',
        role: p.role || (p.is_admin ? 'parent' : 'child'),
        is_admin: Boolean(p.is_admin),
        has_pin: Boolean(p.pin),
        dob: p.dob || null,
        age: dynamicAge,
        birthday_info: getBirthdayInfo(p.dob),
        calendar_ical_url: p.calendar_ical_url || null,
        streak: personStreaks[p.id] || { current_streak: 0, longest_streak: 0, last_completed_date: null },
        badges: personBadges[p.id] || [],
        total_completed: personTotalCompleted[String(p.id)] || 0,
      };
    });

    const kioskUser = kioskRow
      ? {
          id: kioskRow.id,
          name: 'Family Kiosk',
          role: 'family' as const,
          avatar: kioskRow.avatar || 'default_avatar.png',
          color: kioskRow.color || '#3b82f6',
          is_admin: false,
          has_pin: false,
        }
      : {
          id: -1,
          name: 'Family Kiosk',
          role: 'family' as const,
          avatar: 'default_avatar.png',
          color: '#3b82f6',
          is_admin: false,
          has_pin: false,
        };

    const activePersonId = req.session?.person_id;
    let activeUserRow = activePersonId ? peopleRows.find((p) => p.id === activePersonId) : null;
    if (!activeUserRow) {
      activeUserRow = kioskRow || realPeopleRows[0] || null;
    }
    const activeUser = activeUserRow
      ? {
          id: activeUserRow.id,
          name: activeUserRow.role === 'family' ? 'Family Kiosk' : activeUserRow.name,
          role: activeUserRow.role || (activeUserRow.is_admin ? 'parent' : 'child'),
          avatar: activeUserRow.avatar || 'default_avatar.png',
          color: activeUserRow.color || '#ffffff',
          is_admin: Boolean(activeUserRow.is_admin),
          has_pin: Boolean(activeUserRow.pin),
          dob: activeUserRow.dob || null,
          age: calculateAge(activeUserRow.dob, activeUserRow.age),
        }
      : kioskUser;

    const groups = buildHouseholdGroups(family);

    const mealWeekDays = getWeekDaysList(weekStart);
    const { plan: mealPlan, recurring: mealRecurring } = getMealPlanForWeek(weekStart);
    const shopping = getShoppingData();
    const shoppingIntel = getShoppingIntelligence(shopping.general || []);
    const recipes = getAllRecipes();
    const notesKanban = getNotesKanban();
    const gcal = await getGoogleCalendarData();
    const masterPinSet = Boolean(AppSetting.get('master_pin'));

    res.json({
      success: true,
      app_version: APP_VERSION,
      needs_setup: needsSetup,
      current_date: familyToday,
      timezone: getAppTimezone(),
      reward_system: AppSetting.getRewardSystem(),
      master_pin_set: masterPinSet,
      auth: {
        authenticated: !masterPinSet ? true : Boolean(req.session?.authenticated),
        adult_mode: Boolean(req.session?.adult_mode || activeUser?.role === 'parent'),
        adult_name: req.session?.adult_name || (activeUser?.role === 'parent' ? activeUser.name : null),
        person_id: activeUser?.id || null,
        person_name: activeUser?.name || null,
        active_user: activeUser,
      },
      family,
      kiosk: kioskUser,
      groups,
      chores,
      overdue_chore_ids: overdueChoreIds,
      rewards,
      family_progress: familyProgress,
      person_ages: personAges,
      person_streaks: personStreaks,
      person_badges: personBadges,
      person_earned_keys: personEarnedKeys,
      person_total_completed: personTotalCompleted,
      badge_definitions: Object.entries(BADGE_DEFINITIONS).map(([key, v]) => ({ key, ...v })),
      extra_chores: getExtraChores(),
      quiz_questions_enabled: (AppSetting.get('quiz_questions_enabled', 'true') || 'true').toLowerCase() === 'true',
      quiz_questions: loadQuizQuestions(),
      meal_planner: {
        week_start: weekStart,
        week_days: mealWeekDays,
        plan: mealPlan,
        recurring: mealRecurring,
        suggestions: getMealSuggestions(),
        ingredients: getMealIngredients(),
        images: getMealImages(),
        social: getMealSocial(),
      },
      recipes,
      shopping: {
        ...shopping,
        stores: getShoppingStores(),
        intelligence: shoppingIntel,
      },
      notes_kanban: notesKanban,
      text_pads: getTextPads(),
      dashboard_notes: getDashboardNotes(),
      google_calendar: {
        feature_enabled: gcal.featureEnabled,
        enabled: gcal.enabled,
        events: gcal.events,
        today_events: gcal.today_events || [],
        week_columns: gcal.weekColumns,
        hour_labels: gcal.hourLabels,
        embed_url: gcal.embed_url || '',
        ical_url: gcal.ical_url || '',
        last_sync: gcal.last_sync || null,
        error: gcal.error,
      },
      notion: {
        configured: Boolean(AppSetting.get('notion_api_token', '')) && Boolean(AppSetting.get('notion_database_id', '')),
        database_id: AppSetting.get('notion_database_id', '') || '',
        has_token: Boolean(AppSetting.get('notion_api_token', '')),
      },
    });
  } catch (err: any) {
    console.error('[bootstrap] Error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Bootstrap failed' });
  }
});

function handleSetupPost(req: Request, res: Response) {
  try {
    const body = req.body || {};

    // Support both JSON array payload `{ people: [...], ... }` and multipart form arrays `people[]`
    let peopleInput: Array<{
      name: string;
      color?: string;
      age?: number | null;
      is_admin?: boolean;
      pin?: string;
      avatar?: string;
    }> = [];

    const files = (req.files as Express.Multer.File[]) || [];

    if (Array.isArray(body.people) && typeof body.people[0] === 'object') {
      peopleInput = body.people;
    } else {
      const toArr = (v: any) => (Array.isArray(v) ? v : v !== undefined ? [v] : []);
      const names = toArr(body['people[]'] ?? body['person_name[]'] ?? body.people);
      const colors = toArr(body['person_color[]'] ?? body.person_color);
      const ages = toArr(body['person_age[]'] ?? body.person_age);
      const adminsRaw = toArr(body['person_is_admin[]'] ?? body.person_is_admin);
      const pins = toArr(body['person_pin[]'] ?? body.person_pin);
      const adminIndices = new Set(adminsRaw.map((x: any) => Number(x)));

      names.forEach((rawName: any, idx: number) => {
        const name = String(rawName || '').trim();
        if (!name) return;
        const fileForIdx = files[idx];
        peopleInput.push({
          name,
          color: colors[idx] ? String(colors[idx]) : '#3b82f6',
          age: ages[idx] !== undefined && ages[idx] !== '' ? parseInt(String(ages[idx]), 10) : null,
          is_admin: adminIndices.has(idx) || adminsRaw[idx] === true || adminsRaw[idx] === 'true',
          pin: pins[idx] ? String(pins[idx]).trim() : '',
          avatar: fileForIdx ? fileForIdx.filename : 'default_avatar.png',
        });
      });
    }

    const errors: string[] = [];
    if (peopleInput.length === 0) {
      errors.push('Add at least one family member.');
    }

    // Support both initial setup and re-running Setup Wizard from Settings (updating existing people)
    const existingPeople = db.prepare('SELECT * FROM person').all() as Array<any>;
    const existingHasAdminWithPin = existingPeople.some((ep) => Boolean(ep.is_admin && ep.pin));

    let hasValidAdmin = existingHasAdminWithPin;
    for (const p of peopleInput) {
      if (p.is_admin) {
        if (p.pin && /^\d{4}$/.test(p.pin)) {
          hasValidAdmin = true;
        } else if (!existingHasAdminWithPin) {
          errors.push(`${p.name} is marked as an adult but needs a valid 4-digit PIN.`);
        }
      }
    }
    if (errors.length === 0 && !hasValidAdmin) {
      errors.push('At least one adult account with a 4-digit PIN is required.');
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, errors, error: errors[0] });
      return;
    }

    let firstAdminPinHash: string | null = null;
    peopleInput.forEach((p: any, idx: number) => {
      const pinHash = p.is_admin && p.pin && /^\d{4}$/.test(p.pin) ? hashPin(p.pin) : null;
      if (pinHash && !firstAdminPinHash) {
        firstAdminPinHash = pinHash;
      }
      const matchExisting =
        (p.id && existingPeople.find((ep) => ep.id === Number(p.id))) ||
        existingPeople.find((ep) => ep.name.trim().toLowerCase() === p.name.trim().toLowerCase());

      const ageVal =
        p.age !== null && p.age !== undefined && p.age !== '' && !Number.isNaN(Number(p.age))
          ? Number(p.age)
          : null;

      if (matchExisting) {
        db.prepare(
          `UPDATE person SET name = ?, color = ?, "order" = ?, is_admin = ?, age = ?, pin = COALESCE(?, pin) WHERE id = ?`
        ).run(
          p.name,
          p.color || matchExisting.color || '#3b82f6',
          idx,
          p.is_admin ? 1 : 0,
          ageVal,
          pinHash,
          matchExisting.id
        );
      } else {
        db.prepare(
          `INSERT INTO person (name, points, bonus_points, avatar, color, "order", pin, is_admin, age)
           VALUES (?, 0, 0, ?, ?, ?, ?, ?, ?)`
        ).run(
          p.name,
          p.avatar || 'default_avatar.png',
          p.color || '#3b82f6',
          idx,
          pinHash,
          p.is_admin ? 1 : 0,
          ageVal
        );
      }
    });

    if (firstAdminPinHash) {
      AppSetting.set('master_pin', firstAdminPinHash);
    }

    const rewardSystem = body.reward_system === 'cash' ? 'cash' : 'points';
    AppSetting.set('reward_system', rewardSystem);
    AppSetting.set('bonus_mode', String(body.bonus_mode || 'static'));
    AppSetting.set('bonus_static', String(body.bonus_static ?? '10'));
    AppSetting.set('bonus_min', String(body.bonus_min ?? '2'));
    AppSetting.set('bonus_max', String(body.bonus_max ?? '8'));
    const oncePerDay =
      body.bonus_once_per_day === true ||
      body.bonus_once_per_day === 'true' ||
      body.bonus_once_per_day === 'on';
    AppSetting.set('bonus_once_per_day', oncePerDay ? 'true' : 'false');
    const tzVal = String(body.timezone || process.env.TZ || 'Australia/Brisbane').trim();
    AppSetting.set('timezone', tzVal);
    AppSetting.set('app_timezone', tzVal);
    if (body.daily_reset_hour !== undefined) {
      const hr = Math.max(0, Math.min(23, parseInt(String(body.daily_reset_hour ?? '0'), 10) || 0));
      AppSetting.set('daily_reset_hour', String(hr));
    }

    if (req.session) {
      req.session.authenticated = true;
      req.session.adult_mode = true;
      req.session.adult_name = peopleInput.find((p) => p.is_admin)?.name || 'Admin';
    }

    logActivity(
      'setup_completed',
      `Setup wizard completed. Added family members: ${peopleInput.map((p) => p.name).join(', ')}. Reward system: ${rewardSystem}.`,
      'System'
    );

    const acceptsJson =
      req.is('application/json') ||
      String(req.headers.accept || '').includes('application/json') ||
      req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (acceptsJson) {
      res.json({ success: true });
    } else {
      res.redirect('./');
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Setup failed' });
  }
}

stateRouter.post('/setup', setupUpload.any(), handleSetupPost);
stateRouter.post('/setup_wizard', setupUpload.any(), handleSetupPost);
stateRouter.post('/api/setup', setupUpload.any(), handleSetupPost);
