import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { db, AppSetting } from '../db';

declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
    adult_mode?: boolean;
    adult_name?: string;
    person_id?: number;
    person_name?: string;
    celebrate_person?: string;
    celebrate_avatar?: string;
  }
}

const PIN_MAX_ATTEMPTS = 3;
const PIN_LOCKOUT_SECONDS = 120;
const rateLimitMap = new Map<string, { fails: number; lockedUntil: number }>();

function getRlKey(req: Request): string {
  return String(req.headers['x-forwarded-for'] || req.ip || 'local');
}

function rlCheck(key: string): { ok: boolean; retryAfter: number } {
  const entry = rateLimitMap.get(key);
  if (!entry) return { ok: true, retryAfter: 0 };
  const now = Date.now();
  if (entry.lockedUntil > now) {
    return { ok: false, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
    rateLimitMap.delete(key);
  }
  return { ok: true, retryAfter: 0 };
}

function rlFail(key: string): number {
  const entry = rateLimitMap.get(key) || { fails: 0, lockedUntil: 0 };
  entry.fails += 1;
  const remaining = Math.max(0, PIN_MAX_ATTEMPTS - entry.fails);
  if (remaining === 0) {
    entry.lockedUntil = Date.now() + PIN_LOCKOUT_SECONDS * 1000;
  }
  rateLimitMap.set(key, entry);
  return remaining;
}

function rlSuccess(key: string): void {
  rateLimitMap.delete(key);
}

export function checkPinHash(rawPin: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !rawPin) return false;
  try {
    return bcrypt.compareSync(String(rawPin), String(storedHash));
  } catch {
    return false;
  }
}

export function hashPin(rawPin: string): string {
  return bcrypt.hashSync(String(rawPin), 10);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // If no master_pin is configured yet, or session is authenticated, allow
  const masterPin = AppSetting.get('master_pin');
  if (!masterPin || req.session?.authenticated) {
    next();
    return;
  }
  res.status(401).json({ success: false, error: 'Login required' });
}

export function requireAdult(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.adult_mode) {
    next();
    return;
  }
  res.status(403).json({ success: false, error: 'Adult authorisation required' });
}

export const authRouter = Router();

authRouter.get('/api/check_auth', (req: Request, res: Response) => {
  const masterPin = AppSetting.get('master_pin');
  const authenticated = !masterPin ? true : Boolean(req.session?.authenticated);
  res.json({ authenticated });
});

authRouter.get('/api/auth_status', (req: Request, res: Response) => {
  const masterPin = AppSetting.get('master_pin');
  res.json({
    authenticated: !masterPin ? true : Boolean(req.session?.authenticated),
    adult_mode: Boolean(req.session?.adult_mode),
    adult_name: req.session?.adult_name || null,
    person_name: req.session?.person_name || null,
    person_id: req.session?.person_id || null,
  });
});

authRouter.post('/api/person_login', (req: Request, res: Response) => {
  const rlKey = getRlKey(req);
  const { ok, retryAfter } = rlCheck(rlKey);
  if (!ok) {
    res.status(429).json({
      success: false,
      error: `Too many attempts. Try again in ${retryAfter}s.`,
      retry_after: retryAfter,
    });
    return;
  }

  const { person_id, pin } = req.body || {};
  if (!person_id) {
    res.status(400).json({ success: false, error: 'person_id is required' });
    return;
  }

  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(person_id)) as any;
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }

  if (person.pin) {
    if (!checkPinHash(String(pin || ''), person.pin)) {
      const remaining = rlFail(rlKey);
      if (remaining === 0) {
        res.status(429).json({
          success: false,
          error: `Too many wrong attempts. Locked for ${PIN_LOCKOUT_SECONDS}s.`,
          retry_after: PIN_LOCKOUT_SECONDS,
        });
        return;
      }
      const word = remaining === 1 ? 'attempt' : 'attempts';
      res.status(401).json({ success: false, error: `Incorrect PIN — ${remaining} ${word} left` });
      return;
    }
  }

  rlSuccess(rlKey);
  req.session.authenticated = true;
  req.session.person_id = person.id;
  req.session.person_name = person.name;
  req.session.adult_mode = Boolean(person.is_admin);
  if (person.is_admin) {
    req.session.adult_name = person.name;
  } else {
    delete req.session.adult_name;
  }

  res.json({
    success: true,
    person_name: person.name,
    is_admin: Boolean(person.is_admin),
  });
});

authRouter.post('/api/adult_login', (req: Request, res: Response) => {
  const rlKey = getRlKey(req);
  const { ok, retryAfter } = rlCheck(rlKey);
  if (!ok) {
    res.status(429).json({
      success: false,
      error: `Too many attempts. Try again in ${retryAfter}s.`,
      retry_after: retryAfter,
    });
    return;
  }

  const { pin } = req.body || {};
  if (!pin) {
    res.status(400).json({ success: false, error: 'PIN is required' });
    return;
  }

  const admins = db.prepare('SELECT * FROM person WHERE is_admin = 1').all() as Array<any>;
  for (const admin of admins) {
    if (admin.pin && checkPinHash(String(pin), admin.pin)) {
      rlSuccess(rlKey);
      req.session.authenticated = true;
      req.session.adult_mode = true;
      req.session.adult_name = admin.name;
      res.json({ success: true, adult_name: admin.name });
      return;
    }
  }

  const masterPinHash = AppSetting.get('master_pin');
  if (masterPinHash && checkPinHash(String(pin), masterPinHash)) {
    rlSuccess(rlKey);
    req.session.authenticated = true;
    req.session.adult_mode = true;
    req.session.adult_name = 'Admin';
    res.json({ success: true, adult_name: 'Admin' });
    return;
  }

  const remaining = rlFail(rlKey);
  if (remaining === 0) {
    res.status(429).json({
      success: false,
      error: `Too many wrong attempts. Locked for ${PIN_LOCKOUT_SECONDS}s.`,
      retry_after: PIN_LOCKOUT_SECONDS,
    });
    return;
  }
  const word = remaining === 1 ? 'attempt' : 'attempts';
  res.status(401).json({ success: false, error: `Incorrect PIN — ${remaining} ${word} left` });
});

authRouter.post('/api/login', (req: Request, res: Response) => {
  const rlKey = getRlKey(req);
  const { ok, retryAfter } = rlCheck(rlKey);
  if (!ok) {
    res.status(429).json({
      success: false,
      error: `Too many attempts. Try again in ${retryAfter}s.`,
      retry_after: retryAfter,
    });
    return;
  }

  const { pin } = req.body || {};
  if (!pin) {
    res.status(400).json({ success: false, error: 'PIN is required' });
    return;
  }

  const masterPinHash = AppSetting.get('master_pin');
  // Also allow any admin PIN to unlock /api/login
  const admins = db.prepare('SELECT * FROM person WHERE is_admin = 1').all() as Array<any>;
  for (const admin of admins) {
    if (admin.pin && checkPinHash(String(pin), admin.pin)) {
      rlSuccess(rlKey);
      req.session.authenticated = true;
      req.session.adult_mode = true;
      req.session.adult_name = admin.name;
      res.json({ success: true, adult_name: admin.name });
      return;
    }
  }

  if (!masterPinHash) {
    res.status(500).json({ success: false, error: 'Master PIN not set' });
    return;
  }

  if (checkPinHash(String(pin), masterPinHash)) {
    rlSuccess(rlKey);
    req.session.authenticated = true;
    req.session.adult_mode = true;
    req.session.adult_name = 'Admin';
    res.json({ success: true, adult_name: 'Admin' });
    return;
  }

  const remaining = rlFail(rlKey);
  if (remaining === 0) {
    res.status(429).json({
      success: false,
      error: `Too many wrong attempts. Locked for ${PIN_LOCKOUT_SECONDS}s.`,
      retry_after: PIN_LOCKOUT_SECONDS,
    });
    return;
  }
  const word = remaining === 1 ? 'attempt' : 'attempts';
  res.status(401).json({ success: false, error: `Incorrect PIN - ${remaining} ${word} left` });
});

authRouter.post('/api/adult_logout', (req: Request, res: Response) => {
  if (req.session) {
    req.session.adult_mode = false;
    delete req.session.adult_name;
  }
  res.json({ success: true });
});

authRouter.post('/api/switch_user', (req: Request, res: Response) => {
  const { person_id, pin } = req.body || {};
  if (!person_id) {
    res.status(400).json({ success: false, error: 'person_id is required' });
    return;
  }

  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(Number(person_id)) as any;
  if (!person) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }

  const isParent = person.role === 'parent' || person.is_admin === 1;

  if (person.pin) {
    if (!checkPinHash(String(pin || ''), person.pin)) {
      res.status(401).json({ success: false, error: 'Incorrect PIN' });
      return;
    }
  }

  req.session.authenticated = true;
  req.session.person_id = person.id;
  req.session.person_name = person.name;
  req.session.adult_mode = isParent;
  if (isParent) {
    req.session.adult_name = person.name;
  } else {
    delete req.session.adult_name;
  }

  res.json({
    success: true,
    active_user: {
      id: person.id,
      name: person.name,
      role: person.role || (isParent ? 'parent' : 'child'),
      avatar: person.avatar || 'default_avatar.png',
      color: person.color || '#ffffff',
      is_admin: Boolean(person.is_admin),
      has_pin: Boolean(person.pin),
    },
  });
});
