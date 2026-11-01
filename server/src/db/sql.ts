import { getPool } from './client';

/**
 * Parameterised SQL helpers for the handful of handlers whose queries are too
 * dynamic for the Drizzle query builder (multi-table joins, aggregates, batch
 * updates). They run on the same pooled `pg` connection Drizzle uses, bind every
 * value through the driver (no string interpolation, so no injection), and hand
 * back rows/columns in the original snake_case shape so the JSON contract the
 * React client consumes is unchanged.
 *
 * Prefer the typed builder (`getDb().select()…`) for straightforward CRUD.
 */

/** Convert `?` placeholders to Postgres `$n`, ignoring quoted literals. */
function toPgPlaceholders(text: string): string {
  let index = 0;
  let out = '';
  let inSingle = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'") {
      // '' inside a literal is an escaped quote, not the end of the literal
      if (inSingle && text[i + 1] === "'") {
        out += "''";
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      out += ch;
      continue;
    }
    if (ch === '?' && !inSingle) {
      index += 1;
      out += `$${index}`;
      continue;
    }
    out += ch;
  }
  return out;
}

export async function sqlAll<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query(toPgPlaceholders(text), params as any[]);
  return result.rows as T[];
}

export async function sqlOne<T = any>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await sqlAll<T>(text, params);
  return rows[0];
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number | null;
}

/**
 * `INSERT`/`UPDATE`/`DELETE` runner. Inserts get `RETURNING id` appended so the
 * caller still receives the new row id (`lastInsertRowid` in the old code).
 */
export async function sqlRun(text: string, params: unknown[] = []): Promise<RunResult> {
  const isInsert = /^\s*insert\s/i.test(text);
  const wantsId = isInsert && !/returning\s/i.test(text);
  const statement = wantsId ? `${text.replace(/;\s*$/, '')} RETURNING id` : text;
  const result = await getPool().query(toPgPlaceholders(statement), params as any[]);
  const newId = wantsId ? Number((result.rows[0] as { id?: number } | undefined)?.id ?? 0) : null;
  return { changes: result.rowCount ?? 0, lastInsertRowid: newId };
}

/** Multi-statement DDL / maintenance (`PRAGMA`-style calls are not needed in Postgres). */
export async function sqlExec(text: string): Promise<void> {
  await getPool().query(text);
}
