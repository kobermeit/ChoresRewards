import session from 'express-session';
import { db } from '../db';

export class SqliteSessionStore extends session.Store {
  get(sid: string, callback: (err?: any, session?: session.SessionData | null) => void): void {
    try {
      const row = db
        .prepare('SELECT sess FROM session_store WHERE sid = ? AND expired > ?')
        .get(sid, Date.now()) as { sess: string } | undefined;
      if (!row) {
        callback(null, null);
        return;
      }
      const data = JSON.parse(row.sess);
      callback(null, data);
    } catch (err) {
      callback(err);
    }
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void): void {
    try {
      const maxAge = sessionData.cookie?.maxAge || 30 * 24 * 60 * 60 * 1000;
      const expired = Date.now() + maxAge;
      db.prepare(`
        INSERT INTO session_store (sid, sess, expired)
        VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired
      `).run(sid, JSON.stringify(sessionData), expired);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    try {
      db.prepare('DELETE FROM session_store WHERE sid = ?').run(sid);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void): void {
    try {
      const maxAge = sessionData.cookie?.maxAge || 30 * 24 * 60 * 60 * 1000;
      const expired = Date.now() + maxAge;
      db.prepare('UPDATE session_store SET expired = ? WHERE sid = ?').run(expired, sid);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }
}
