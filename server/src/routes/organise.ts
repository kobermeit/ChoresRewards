import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db, logActivity } from '../db';
import { UPLOADS_DIR } from '../config';
import { requireAdult } from './auth';
import { getFamilyToday, isChoreOverdue } from '../utils/time';

const organisePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(UPLOADS_DIR, 'organise'));
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${req.params.itemId}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function diffDays(targetIso: string, todayIso: string): number {
  const [ty, tm, td] = targetIso.slice(0, 10).split('-').map(Number);
  const [cy, cm, cd] = todayIso.slice(0, 10).split('-').map(Number);
  const tUtc = Date.UTC(ty, tm - 1, td);
  const cUtc = Date.UTC(cy, cm - 1, cd);
  return Math.round((tUtc - cUtc) / 86400000);
}

export function formatOrganiseItem(row: any, todayIso = getFamilyToday()) {
  let status = 'ok';
  let daysUntilDue: number | null = null;
  if (row.due_date) {
    daysUntilDue = diffDays(String(row.due_date), todayIso);
    if (!row.paid) {
      if (daysUntilDue < 0) status = 'overdue';
      else if (daysUntilDue <= (Number(row.reminder_days) || 30)) status = 'due_soon';
    }
  }
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    provider: row.provider || null,
    notes: row.notes || null,
    due_date: row.due_date || null,
    last_date: row.last_date || null,
    paid: Boolean(row.paid),
    cost: row.cost !== null && row.cost !== undefined ? Number(row.cost) : null,
    reminder_days: row.reminder_days ?? 30,
    icon: row.icon || null,
    sort_order: row.sort_order ?? 0,
    status,
    days_until_due: daysUntilDue,
    photo_url: row.photo_filename ? `/static/uploads/organise/${row.photo_filename}` : null,
    vehicle_make: row.vehicle_make || null,
    vehicle_model: row.vehicle_model || null,
    vehicle_year: row.vehicle_year ?? null,
    vehicle_rego: row.vehicle_rego || null,
    current_odometer: row.current_odometer ?? null,
    next_service_date: row.next_service_date || null,
    next_service_mileage: row.next_service_mileage ?? null,
    parent_id: row.parent_id ?? null,
  };
}

export function formatVehicleService(row: any) {
  return {
    id: row.id,
    organise_item_id: row.organise_item_id,
    service_type: row.service_type,
    service_date: row.service_date || null,
    next_service_date: row.next_service_date || null,
    next_service_mileage: row.next_service_mileage ?? null,
    mileage: row.mileage ?? null,
    cost: row.cost !== null && row.cost !== undefined ? Number(row.cost) : null,
    provider: row.provider || null,
    notes: row.notes || null,
  };
}

function optionalInt(raw: any): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = parseInt(String(raw), 10);
  return Number.isNaN(n) ? null : n;
}

function optionalDate(raw: any): string | null {
  const s = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function validateParentId(raw: any, excludeId?: number): number | null {
  if (raw === null || raw === undefined || raw === '' || raw === 0 || raw === '0') return null;
  const parentId = Number(raw);
  if (Number.isNaN(parentId)) throw new Error('Invalid linked car');
  if (excludeId && parentId === excludeId) throw new Error('A car cannot be linked to itself');
  const parent = db.prepare('SELECT * FROM organise_item WHERE id = ?').get(parentId) as any;
  if (!parent) throw new Error('Linked car not found');
  if (parent.parent_id) throw new Error('Can only link to a car, not another document');
  if (parent.category !== 'Car') throw new Error('Linked item must be a car');
  return parentId;
}

export const organiseRouter = Router();

organiseRouter.get('/api/notifications', (_req: Request, res: Response) => {
  const today = getFamilyToday();
  const alerts: Array<any> = [];

  // 1. Organise items due within 7 days or overdue
  const orgItems = db.prepare('SELECT * FROM organise_item WHERE paid = 0 AND due_date IS NOT NULL').all() as Array<any>;
  for (const item of orgItems) {
    const days = diffDays(String(item.due_date), today);
    if (days <= 7) {
      alerts.push({
        kind: 'organise',
        severity: days < 0 ? 'overdue' : 'due_soon',
        days,
        title: item.title,
        detail:
          days < 0
            ? `Overdue by ${Math.abs(days)}d (${item.category})`
            : days === 0
              ? `Due today (${item.category})`
              : `Due in ${days}d (${item.category})`,
        target: 'organise-section',
        admin_only: true,
      });
    }
  }

  // 2. Vehicle services next_service_date due within 7 days
  const svcRows = db
    .prepare(
      `SELECT vs.*, oi.title as vehicle_title
       FROM vehicle_service vs
       JOIN organise_item oi ON oi.id = vs.organise_item_id
       WHERE vs.next_service_date IS NOT NULL`
    )
    .all() as Array<any>;
  for (const svc of svcRows) {
    const days = diffDays(String(svc.next_service_date), today);
    if (days <= 7) {
      alerts.push({
        kind: 'service',
        severity: days < 0 ? 'overdue' : 'due_soon',
        days,
        title: `${svc.vehicle_title}: ${svc.service_type}`,
        detail: days < 0 ? `Service overdue by ${Math.abs(days)}d` : days === 0 ? 'Service due today' : `Service in ${days}d`,
        target: 'organise-section',
        admin_only: true,
      });
    }
  }

  // 3. Chores with deadlines
  const openChores = db
    .prepare('SELECT * FROM chore WHERE completed = 0 AND deleted = 0 AND (due_datetime IS NOT NULL OR (is_daily = 0 AND due_date IS NOT NULL))')
    .all() as Array<any>;
  for (const c of openChores) {
    const dueStr = c.due_datetime ? String(c.due_datetime).slice(0, 10) : String(c.due_date).slice(0, 10);
    const days = diffDays(dueStr, today);
    if (days <= 7) {
      const overdue = days < 0 || isChoreOverdue(c);
      alerts.push({
        kind: 'chore',
        severity: overdue ? 'overdue' : 'due_soon',
        days,
        title: c.title,
        detail: `${c.assigned_to || 'Unassigned'} — ${overdue ? 'Overdue' : days === 0 ? 'Due today' : `Due in ${days}d`}`,
        target: 'kanban',
        admin_only: false,
      });
    }
  }

  alerts.sort((a, b) => {
    const sevA = a.severity === 'overdue' ? 0 : 1;
    const sevB = b.severity === 'overdue' ? 0 : 1;
    if (sevA !== sevB) return sevA - sevB;
    return a.days - b.days;
  });

  const recentLogs = db.prepare('SELECT * FROM activity_log ORDER BY date DESC, id DESC LIMIT 12').all() as Array<any>;
  const recent = recentLogs.map((l) => ({
    id: l.id,
    type: l.type,
    description: l.description,
    user_name: l.user_name || 'System',
    date_label: String(l.date).slice(0, 16),
  }));

  const overdueCount = alerts.filter((a) => a.severity === 'overdue').length;
  res.json({
    success: true,
    alerts,
    recent,
    alert_count: alerts.length,
    overdue_count: overdueCount,
  });
});

organiseRouter.get(['/api/organise', '/api/organise/items'], (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM organise_item ORDER BY category, sort_order, id').all() as Array<any>;
  const today = getFamilyToday();
  res.json({
    success: true,
    items: rows.map((r) => formatOrganiseItem(r, today)),
  });
});

organiseRouter.post(['/api/organise', '/api/organise/items'], requireAdult, (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const title = String(data.title || '').trim().slice(0, 200);
    if (!title) {
      res.status(400).json({ success: false, error: 'Title is required' });
      return;
    }
    const category = String(data.category || 'General').trim().slice(0, 80) || 'General';
    const provider = String(data.provider || '').trim().slice(0, 200) || null;
    const notes = String(data.notes || '').trim().slice(0, 2000) || null;
    const icon = String(data.icon || '').trim().slice(0, 10) || null;
    const paid = Boolean(data.paid);
    const cost = data.cost !== null && data.cost !== undefined && data.cost !== '' ? Number(data.cost) : null;
    const reminderDays = Math.max(1, Math.min(365, parseInt(String(data.reminder_days ?? 30), 10) || 30));
    const dueDate = optionalDate(data.due_date);
    const lastDate = optionalDate(data.last_date);
    const parentId = validateParentId(data.parent_id);

    let vehicleMake = String(data.vehicle_make || '').trim().slice(0, 100) || null;
    let vehicleModel = String(data.vehicle_model || '').trim().slice(0, 100) || null;
    let vehicleYear = optionalInt(data.vehicle_year);
    let vehicleRego = String(data.vehicle_rego || '').trim().slice(0, 20) || null;
    let currentOdometer = optionalInt(data.current_odometer);
    let nextServiceDate = optionalDate(data.next_service_date);
    let nextServiceMileage = optionalInt(data.next_service_mileage);

    if (parentId) {
      vehicleMake = null;
      vehicleModel = null;
      vehicleYear = null;
      vehicleRego = null;
      currentOdometer = null;
      nextServiceDate = null;
      nextServiceMileage = null;
    }

    const info = db
      .prepare(
        `INSERT INTO organise_item (
          category, title, provider, notes, due_date, last_date, paid, cost, reminder_days, icon,
          vehicle_make, vehicle_model, vehicle_year, vehicle_rego, current_odometer,
          next_service_date, next_service_mileage, parent_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        category,
        title,
        provider,
        notes,
        dueDate,
        lastDate,
        paid ? 1 : 0,
        cost,
        reminderDays,
        icon,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        vehicleRego,
        currentOdometer,
        nextServiceDate,
        nextServiceMileage,
        parentId
      );

    const inserted = db.prepare('SELECT * FROM organise_item WHERE id = ?').get(Number(info.lastInsertRowid));
    logActivity('organise_added', `Organise item '${title}' added in category '${category}'`);
    res.json({ success: true, item: formatOrganiseItem(inserted) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

organiseRouter.post(['/api/organise/:itemId/renew', '/api/organise/items/:itemId/renew'], requireAdult, (req: Request, res: Response) => {
  const itemId = Number(req.params.itemId);
  const row = db.prepare('SELECT * FROM organise_item WHERE id = ?').get(itemId) as any;
  if (!row) {
    res.status(404).json({ success: false, error: 'Item not found' });
    return;
  }
  const months = Math.max(1, Number(req.body?.months) || 12);
  const base = row.due_date ? new Date(row.due_date) : new Date();
  base.setMonth(base.getMonth() + months);
  const newDue = base.toISOString().slice(0, 10);
  db.prepare('UPDATE organise_item SET due_date = ?, last_date = ?, paid = 1 WHERE id = ?').run(
    newDue,
    row.due_date || getFamilyToday(),
    itemId
  );
  logActivity('organise_renewed', `Renewed ${row.title} to ${newDue}`);
  const updated = db.prepare('SELECT * FROM organise_item WHERE id = ?').get(itemId);
  res.json({ success: true, item: formatOrganiseItem(updated) });
});

organiseRouter.put(['/api/organise/:itemId', '/api/organise/items/:itemId'], requireAdult, (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.itemId);
    const existing = db.prepare('SELECT * FROM organise_item WHERE id = ?').get(itemId) as any;
    if (!existing) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }
    const data = req.body || {};

    const title = 'title' in data ? String(data.title || '').trim().slice(0, 200) : existing.title;
    if (!title) {
      res.status(400).json({ success: false, error: 'Title cannot be empty' });
      return;
    }
    const category = 'category' in data ? String(data.category || '').trim().slice(0, 80) || 'General' : existing.category;
    const provider = 'provider' in data ? String(data.provider || '').trim().slice(0, 200) || null : existing.provider;
    const notes = 'notes' in data ? String(data.notes || '').trim().slice(0, 2000) || null : existing.notes;
    const icon = 'icon' in data ? String(data.icon || '').trim().slice(0, 10) || null : existing.icon;
    const paid = 'paid' in data ? Boolean(data.paid) : Boolean(existing.paid);
    const cost =
      'cost' in data
        ? data.cost !== null && data.cost !== undefined && data.cost !== ''
          ? Number(data.cost)
          : null
        : existing.cost;
    const reminderDays =
      'reminder_days' in data
        ? Math.max(1, Math.min(365, parseInt(String(data.reminder_days || 30), 10) || 30))
        : existing.reminder_days;
    const dueDate = 'due_date' in data ? optionalDate(data.due_date) : existing.due_date;
    const lastDate = 'last_date' in data ? optionalDate(data.last_date) : existing.last_date;
    const parentId = 'parent_id' in data ? validateParentId(data.parent_id, itemId) : existing.parent_id;

    let vehicleMake =
      'vehicle_make' in data ? String(data.vehicle_make || '').trim().slice(0, 100) || null : existing.vehicle_make;
    let vehicleModel =
      'vehicle_model' in data ? String(data.vehicle_model || '').trim().slice(0, 100) || null : existing.vehicle_model;
    let vehicleYear = 'vehicle_year' in data ? optionalInt(data.vehicle_year) : existing.vehicle_year;
    let vehicleRego =
      'vehicle_rego' in data ? String(data.vehicle_rego || '').trim().slice(0, 20) || null : existing.vehicle_rego;
    let currentOdometer = 'current_odometer' in data ? optionalInt(data.current_odometer) : existing.current_odometer;
    let nextServiceDate = 'next_service_date' in data ? optionalDate(data.next_service_date) : existing.next_service_date;
    let nextServiceMileage =
      'next_service_mileage' in data ? optionalInt(data.next_service_mileage) : existing.next_service_mileage;

    if (parentId) {
      vehicleMake = null;
      vehicleModel = null;
      vehicleYear = null;
      vehicleRego = null;
      currentOdometer = null;
      nextServiceDate = null;
      nextServiceMileage = null;
    }

    db.prepare(
      `UPDATE organise_item SET
        category = ?, title = ?, provider = ?, notes = ?, due_date = ?, last_date = ?,
        paid = ?, cost = ?, reminder_days = ?, icon = ?,
        vehicle_make = ?, vehicle_model = ?, vehicle_year = ?, vehicle_rego = ?,
        current_odometer = ?, next_service_date = ?, next_service_mileage = ?, parent_id = ?
       WHERE id = ?`
    ).run(
      category,
      title,
      provider,
      notes,
      dueDate,
      lastDate,
      paid ? 1 : 0,
      cost,
      reminderDays,
      icon,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleRego,
      currentOdometer,
      nextServiceDate,
      nextServiceMileage,
      parentId,
      itemId
    );

    const updated = db.prepare('SELECT * FROM organise_item WHERE id = ?').get(itemId);
    logActivity('organise_updated', `Organise item '${title}' updated`);
    res.json({ success: true, item: formatOrganiseItem(updated) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

organiseRouter.post(
  ['/api/organise/:itemId/photo', '/api/organise/items/:itemId/photo'],
  requireAdult,
  organisePhotoUpload.single('photo'),
  (req: Request, res: Response) => {
    const itemId = Number(req.params.itemId);
    const item = db.prepare('SELECT * FROM organise_item WHERE id = ?').get(itemId) as any;
    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file provided' });
      return;
    }

    if (item.photo_filename) {
      const oldPath = path.join(UPLOADS_DIR, 'organise', item.photo_filename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          // ignore
        }
      }
    }

    db.prepare('UPDATE organise_item SET photo_filename = ? WHERE id = ?').run(req.file.filename, itemId);
    logActivity('organise_photo', `Photo uploaded for '${item.title}'`);
    res.json({
      success: true,
      photo_url: `/static/uploads/organise/${req.file.filename}`,
    });
  }
);

organiseRouter.delete(['/api/organise/:itemId', '/api/organise/items/:itemId'], requireAdult, (req: Request, res: Response) => {
  const itemId = Number(req.params.itemId);
  const item = db.prepare('SELECT * FROM organise_item WHERE id = ?').get(itemId) as any;
  if (!item) {
    res.status(404).json({ success: false, error: 'Item not found' });
    return;
  }
  db.prepare('DELETE FROM organise_item WHERE parent_id = ?').run(itemId);
  db.prepare('DELETE FROM vehicle_service WHERE organise_item_id = ?').run(itemId);
  db.prepare('DELETE FROM organise_item WHERE id = ?').run(itemId);
  logActivity('organise_deleted', `Organise item '${item.title}' deleted`);
  res.json({ success: true });
});

organiseRouter.get(['/api/organise/:itemId/services', '/api/organise/items/:itemId/services'], (req: Request, res: Response) => {
  const itemId = Number(req.params.itemId);
  const item = db.prepare('SELECT * FROM organise_item WHERE id = ?').get(itemId);
  if (!item) {
    res.status(404).json({ success: false, error: 'Vehicle not found' });
    return;
  }
  const services = db
    .prepare('SELECT * FROM vehicle_service WHERE organise_item_id = ? ORDER BY service_date DESC, id DESC')
    .all(itemId) as Array<any>;
  res.json({ success: true, services: services.map(formatVehicleService) });
});

organiseRouter.post(['/api/organise/:itemId/services', '/api/organise/items/:itemId/services'], requireAdult, (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.itemId);
    const item = db.prepare('SELECT * FROM organise_item WHERE id = ?').get(itemId) as any;
    if (!item) {
      res.status(404).json({ success: false, error: 'Vehicle not found' });
      return;
    }
    const data = req.body || {};
    const serviceType = String(data.service_type || '').trim().slice(0, 200);
    if (!serviceType) {
      res.status(400).json({ success: false, error: 'Service type is required' });
      return;
    }
    const serviceDate = optionalDate(data.service_date);
    const mileage = optionalInt(data.mileage);
    const cost = data.cost !== null && data.cost !== undefined && data.cost !== '' ? Number(data.cost) : null;
    const provider = String(data.provider || '').trim().slice(0, 200) || null;
    const notes = String(data.notes || '').trim().slice(0, 2000) || null;
    const nextServiceDate = optionalDate(data.next_service_date);
    const nextServiceMileage = optionalInt(data.next_service_mileage);

    const info = db
      .prepare(
        `INSERT INTO vehicle_service (
          organise_item_id, service_type, service_date, mileage, cost, provider, notes, next_service_date, next_service_mileage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(itemId, serviceType, serviceDate, mileage, cost, provider, notes, nextServiceDate, nextServiceMileage);

    if (mileage !== null && (item.current_odometer === null || mileage > item.current_odometer)) {
      db.prepare('UPDATE organise_item SET current_odometer = ? WHERE id = ?').run(mileage, itemId);
    }
    if (nextServiceDate !== null) {
      db.prepare('UPDATE organise_item SET next_service_date = ? WHERE id = ?').run(nextServiceDate, itemId);
    }
    if (nextServiceMileage !== null) {
      db.prepare('UPDATE organise_item SET next_service_mileage = ? WHERE id = ?').run(nextServiceMileage, itemId);
    }

    const svc = db.prepare('SELECT * FROM vehicle_service WHERE id = ?').get(Number(info.lastInsertRowid));
    logActivity('vehicle_service_added', `Service '${serviceType}' added to '${item.title}'`);
    res.json({ success: true, service: formatVehicleService(svc) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

organiseRouter.put(['/api/organise/:itemId/services/:serviceId', '/api/organise/items/:itemId/services/:serviceId'], requireAdult, (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.itemId);
    const serviceId = Number(req.params.serviceId);
    const svc = db
      .prepare('SELECT * FROM vehicle_service WHERE id = ? AND organise_item_id = ?')
      .get(serviceId, itemId) as any;
    if (!svc) {
      res.status(404).json({ success: false, error: 'Service record not found' });
      return;
    }
    const item = db.prepare('SELECT * FROM organise_item WHERE id = ?').get(itemId) as any;
    const data = req.body || {};

    const serviceType = 'service_type' in data ? String(data.service_type || '').trim().slice(0, 200) : svc.service_type;
    if (!serviceType) {
      res.status(400).json({ success: false, error: 'Service type cannot be empty' });
      return;
    }
    const serviceDate = 'service_date' in data ? optionalDate(data.service_date) : svc.service_date;
    const mileage = 'mileage' in data ? optionalInt(data.mileage) : svc.mileage;
    const cost =
      'cost' in data
        ? data.cost !== null && data.cost !== undefined && data.cost !== ''
          ? Number(data.cost)
          : null
        : svc.cost;
    const provider = 'provider' in data ? String(data.provider || '').trim().slice(0, 200) || null : svc.provider;
    const notes = 'notes' in data ? String(data.notes || '').trim().slice(0, 2000) || null : svc.notes;
    const nextServiceDate = 'next_service_date' in data ? optionalDate(data.next_service_date) : svc.next_service_date;
    const nextServiceMileage =
      'next_service_mileage' in data ? optionalInt(data.next_service_mileage) : svc.next_service_mileage;

    db.prepare(
      `UPDATE vehicle_service SET
        service_type = ?, service_date = ?, mileage = ?, cost = ?, provider = ?, notes = ?,
        next_service_date = ?, next_service_mileage = ?
       WHERE id = ?`
    ).run(serviceType, serviceDate, mileage, cost, provider, notes, nextServiceDate, nextServiceMileage, serviceId);

    if (item) {
      if (mileage !== null && (item.current_odometer === null || mileage > item.current_odometer)) {
        db.prepare('UPDATE organise_item SET current_odometer = ? WHERE id = ?').run(mileage, itemId);
      }
      if (nextServiceDate !== null) {
        db.prepare('UPDATE organise_item SET next_service_date = ? WHERE id = ?').run(nextServiceDate, itemId);
      }
      if (nextServiceMileage !== null) {
        db.prepare('UPDATE organise_item SET next_service_mileage = ? WHERE id = ?').run(nextServiceMileage, itemId);
      }
    }

    const updated = db.prepare('SELECT * FROM vehicle_service WHERE id = ?').get(serviceId);
    logActivity('vehicle_service_updated', `Service '${serviceType}' updated`);
    res.json({ success: true, service: formatVehicleService(updated) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

organiseRouter.delete(['/api/organise/:itemId/services/:serviceId', '/api/organise/items/:itemId/services/:serviceId'], requireAdult, (req: Request, res: Response) => {
  const itemId = Number(req.params.itemId);
  const serviceId = Number(req.params.serviceId);
  const svc = db
    .prepare('SELECT * FROM vehicle_service WHERE id = ? AND organise_item_id = ?')
    .get(serviceId, itemId) as any;
  if (!svc) {
    res.status(404).json({ success: false, error: 'Service record not found' });
    return;
  }
  db.prepare('DELETE FROM vehicle_service WHERE id = ?').run(serviceId);
  logActivity('vehicle_service_deleted', `Service '${svc.service_type}' deleted`);
  res.json({ success: true });
});
