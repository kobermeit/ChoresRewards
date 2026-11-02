/**
 * Boot-path retry helper.
 *
 * v1.20.0 failed to deploy because the *first* Postgres hiccup was fatal: a
 * single transient `getaddrinfo EAI_AGAIN` (Docker's embedded DNS not answering
 * while containers are recreated, or the Postgres container still starting)
 * aborted the migration run, `start()` exited the process and the orchestrator
 * reported a failed deployment.
 *
 * Everything the boot path does is idempotent — Drizzle migrations are tracked in
 * `drizzle.__drizzle_migrations` and run transactionally, the seeds are guarded by
 * row counts — so retrying the whole step is safe.
 *
 * Two rules keep this honest:
 *   1. Only *transient* failures are retried. A wrong password, a missing
 *      database or a permission error fails immediately — retrying those would
 *      just turn a clear log line into a 45-second hang.
 *   2. The budget is bounded, so a genuinely down database still fails the
 *      container before the orchestrator's health check window closes.
 */

/** Network/DNS/startup failures that fix themselves. */
const TRANSIENT_ERROR_CODES = new Set([
  'EAI_AGAIN', // temporary DNS failure (Docker DNS not answering yet)
  'ENOTFOUND', // hostname not registered yet (Postgres container still starting)
  'EAI_FAIL',
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EHOSTDOWN',
  '57P03', // cannot_connect_now — Postgres is still starting up
  '53300', // too_many_connections — briefly, during a rolling deploy
  '08000',
  '08001',
  '08003',
  '08004',
  '08006', // connection exceptions
]);

/** Configuration errors that will never resolve on their own. */
const FATAL_ERROR_CODES = new Set([
  '28P01', // invalid_password
  '28000', // invalid_authorization_specification
  '3D000', // invalid_catalog_name (database does not exist)
  '42501', // insufficient_privilege
  '42P01', // undefined_table — this build's migrations never ran
]);

/**
 * Postgres SQLSTATEs, `pg` network codes and Node `errno` codes all live on
 * `err.code`, but Drizzle wraps driver errors in a `DrizzleQueryError` whose
 * `code` is undefined — the real one sits on `.cause`. Walk the chain.
 */
export function findErrorCode(err: unknown): string | undefined {
  let current = err as { code?: unknown; cause?: unknown } | undefined;
  for (let depth = 0; current && depth < 6; depth += 1) {
    if (typeof current.code === 'string' && current.code) return current.code;
    current = current.cause as { code?: unknown; cause?: unknown } | undefined;
  }
  return undefined;
}

/** The innermost error — Drizzle/pg wrap the useful message several levels deep. */
export function rootCause(err: unknown): unknown {
  let current = err as { cause?: unknown } | undefined;
  let depth = 0;
  while (current?.cause && depth < 6) {
    current = current.cause as { cause?: unknown };
    depth += 1;
  }
  return current ?? err;
}

/** One-line description, e.g. `EAI_AGAIN: getaddrinfo EAI_AGAIN postgres-uuid`. */
export function describeDbError(err: unknown): string {
  const root = rootCause(err) as { message?: string } | undefined;
  const code = findErrorCode(err);
  const message = root?.message || (err instanceof Error ? err.message : String(err));
  if (!code) return message;
  return message.startsWith(code) ? message : `${code}: ${message}`;
}

function isTransientDbError(err: unknown): boolean {
  const code = findErrorCode(err);
  if (code && FATAL_ERROR_CODES.has(code)) return false;
  if (code && TRANSIENT_ERROR_CODES.has(code)) return true;
  // Whole SQLSTATE classes: 08 = connection exception, 53 = insufficient resources
  if (code && (code.startsWith('08') || code.startsWith('53'))) return true;

  // Last resort: some layers rewrite `code`, so match the message shape.
  const text = describeDbError(err).toLowerCase();
  return /eai_again|econnrefused|econnreset|connection terminated|server closed the connection unexpectedly|timeout expired|connection timeout/.test(
    text
  );
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Default boot budget: comfortably inside the image health check's start period. */
export const DEFAULT_DB_BOOT_BUDGET_MS = Number(process.env.DB_BOOT_TIMEOUT_MS || 45_000);

export interface DbRetryOptions {
  /** Human label used in the log lines, e.g. "database initialisation". */
  label: string;
  /** Total time to keep trying before giving up. Defaults to DB_BOOT_TIMEOUT_MS (45 s). */
  budgetMs?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}


/**
 * Run `task`, retrying transient database failures with exponential backoff and a
 * little jitter until the budget runs out. Throws the original error (wrapped in a
 * clearer message) when it can no longer usefully wait.
 */
export async function withDbRetry<T>(task: () => Promise<T>, options: DbRetryOptions): Promise<T> {
  const label = options.label;
  const budgetMs = Math.max(1_000, options.budgetMs ?? DEFAULT_DB_BOOT_BUDGET_MS);
  const maxDelayMs = options.maxDelayMs ?? 6_000;
  const deadline = Date.now() + budgetMs;
  const startedAt = Date.now();

  let attempt = 0;
  let delay = options.initialDelayMs ?? 750;

  for (;;) {
    attempt += 1;
    try {
      const value = await task();
      if (attempt > 1) {
        console.log(
          `[db] ${label} recovered on attempt ${attempt} (${((Date.now() - startedAt) / 1000).toFixed(1)}s).`
        );
      }
      return value;
    } catch (err) {
      const transient = isTransientDbError(err);
      const remaining = deadline - Date.now();
      if (!transient || remaining <= 0) {
        const gaveUp = transient ? ` after ${attempt} attempt(s) over ${budgetMs / 1000}s` : '';
        const fatal = new Error(`${label} failed${gaveUp}: ${describeDbError(err)}`);
        (fatal as Error & { cause?: unknown }).cause = err;
        throw fatal;
      }

      const wait = Math.min(delay, maxDelayMs, remaining) * (1 + (Math.random() - 0.5) * 0.2);
      console.warn(
        `[db] ${label} failed on attempt ${attempt} — ${describeDbError(err)}. ` +
          `Retrying in ${(wait / 1000).toFixed(1)}s (${Math.ceil(remaining / 1000)}s of budget left).`
      );
      await sleep(wait);
      delay = Math.min(delay * 1.8, maxDelayMs);
    }
  }
}
