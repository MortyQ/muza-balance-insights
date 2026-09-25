// The request slot, shared across processes via the api_calls table: at most one request per `intervalMs`.
// The interval is the provider's (Monobank: 60 s).
import { cancellableSleep } from './cancel.ts';
import type { Db } from './db.ts';
import { RateLimitError } from './errors.ts';
import type { Clock } from './platform.ts';

export type RateLimitMode =
  /** CLI: sleep until the shared slot is free. */
  | 'wait'
  /** MCP: never block — throw RateLimitError with the remaining seconds. */
  | 'fail';

export type RateLimit = { intervalMs: number; bank: string };

export async function recordCall(db: Db, endpoint: string, atMs: number): Promise<void> {
  await db.execute({ sql: 'INSERT INTO api_calls (endpoint, called_at) VALUES (?, ?)', args: [endpoint, atMs] });
}

/** Milliseconds until the shared slot frees up (0 = free now). */
export async function msUntilSlotFree(db: Db, nowMs: number, intervalMs: number): Promise<number> {
  const rs = await db.execute('SELECT MAX(called_at) AS last FROM api_calls');
  const last = rs.rows[0]?.last;
  if (last === null || last === undefined) return 0;
  return Math.max(0, Number(last) + intervalMs - nowMs);
}

/**
 * Atomically claims the slot: one INSERT … WHERE NOT EXISTS is a single SQLite write,
 * so two processes can't both claim it. Loops (mode 'wait') or throws (mode 'fail').
 */
export async function acquireSlot(
  db: Db,
  endpoint: string,
  clock: Clock,
  mode: RateLimitMode,
  limit: RateLimit,
  onWait?: (waitMs: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  for (;;) {
    const now = clock.nowMs();
    const rs = await db.execute({
      sql: `INSERT INTO api_calls (endpoint, called_at)
            SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM api_calls WHERE called_at > ?)`,
      args: [endpoint, now, now - limit.intervalMs],
    });
    if (rs.rowsAffected === 1) {
      await db.execute({ sql: 'DELETE FROM api_calls WHERE called_at < ?', args: [now - 86_400_000] });
      return;
    }
    const waitMs = Math.max(1, await msUntilSlotFree(db, now, limit.intervalMs));
    if (mode === 'fail') throw new RateLimitError(Math.ceil(waitMs / 1000), 'local', limit.bank, limit.intervalMs / 1000);
    onWait?.(waitMs);
    await cancellableSleep(clock, waitMs, signal);
  }
}
