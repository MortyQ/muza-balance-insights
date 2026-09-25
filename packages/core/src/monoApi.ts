import { z } from 'zod';
import { RATE_LIMIT_MS } from './constants.ts';
import type { Db } from './db.ts';
import { SyncCancelledError, cancellableSleep, throwIfCancelled } from './cancel.ts';
import type { Clock, FetchLike, ResponseLike } from './platform.ts';

export type { Clock } from './platform.ts';

const BASE_URL = 'https://api.monobank.ua';
const REQUEST_TIMEOUT_MS = 30_000;

// ---------- response schemas (don't trust the format blindly) ----------

const int = z.number().int();

const CardSchema = z.object({
  id: z.string().min(1),
  balance: int,
  creditLimit: int.optional(),
  type: z.string().optional(),
  currencyCode: int,
  maskedPan: z.array(z.string()).optional(),
  iban: z.string().optional(),
});

const JarSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  currencyCode: int,
  balance: int,
  goal: int.nullish(),
});

export const ClientInfoSchema = z.object({
  accounts: z.array(CardSchema).default([]),
  jars: z.array(JarSchema).default([]),
});

/**
 * Statement item. Not .strict(): unknown fields are stripped, never fail the sync.
 * Required: id, time, amount, currencyCode, hold, mcc. Everything else may be absent (stored as NULL).
 */
export const StatementItemSchema = z.object({
  id: z.string().min(1),
  time: int,
  amount: int,
  currencyCode: int,
  hold: z.boolean(),
  mcc: int,
  description: z.string().optional(),
  originalMcc: int.optional(),
  operationAmount: int.optional(),
  commissionRate: int.optional(),
  cashbackAmount: int.optional(),
  balance: int.optional(),
  comment: z.string().optional(),
  receiptId: z.string().optional(),
  invoiceId: z.string().optional(),
  counterEdrpou: z.string().optional(),
  counterIban: z.string().optional(),
  counterName: z.string().optional(),
});

export type ClientInfo = z.infer<typeof ClientInfoSchema>;
export type Card = z.infer<typeof CardSchema>;
export type Jar = z.infer<typeof JarSchema>;
export type StatementItem = z.infer<typeof StatementItemSchema> & {
  /** The original JSON object from the API, re-serialized. */
  raw: string;
};

// ---------- errors (never contain the token, URL-with-secrets or headers) ----------

export class RateLimitError extends Error {
  override name = 'RateLimitError';
  constructor(
    readonly retryAfterSec: number,
    readonly source: 'local' | 'server',
  ) {
    super(
      source === 'server'
        ? `Monobank вернул 429 (rate limit). Повтори через ${retryAfterSec} с.`
        : `Лимит Monobank API: 1 запрос в 60 с. Следующий запрос возможен через ${retryAfterSec} с.`,
    );
  }
}

/**
 * A statement item failed validation. Carries only field names and the transaction id —
 * never amounts, descriptions or counterparties.
 */
export class StatementFormatError extends Error {
  override name = 'StatementFormatError';
  constructor(
    readonly fields: string[],
    readonly transactionId: string | null,
    readonly itemIndex: number,
  ) {
    super(
      `Неожиданный формат транзакции ${transactionId ?? `#${itemIndex} (без id)`}: поля ${fields.join(', ')}`,
    );
  }
}

export class MonoApiError extends Error {
  override name = 'MonoApiError';
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

// ---------- client ----------

export type RateLimitMode =
  /** CLI: sleep until the shared slot is free. */
  | 'wait'
  /** MCP: never block — throw RateLimitError with the remaining seconds. */
  | 'fail';

export type MonoClientOptions = {
  token: string;
  db: Db;
  fetch: FetchLike;
  clock: Clock;
  rateLimitMode?: RateLimitMode;
  /** Called before sleeping for the rate limit (progress output). */
  onWait?: (waitMs: number) => void;
  /** Cancels waits and in-flight requests (SyncCancelledError). */
  signal?: AbortSignal;
};

export type MonoClient = {
  clientInfo(): Promise<ClientInfo>;
  /** One raw statement request (no pagination). `from`/`to` are unix seconds. */
  statement(accountId: string, from: number, to: number): Promise<StatementItem[]>;
};

export function createMonoClient(opts: MonoClientOptions): MonoClient {
  const { token, db } = opts;
  const { fetch: doFetch, clock } = opts;
  const mode = opts.rateLimitMode ?? 'wait';

  const redact = (s: string): string => (token ? s.split(token).join('***') : s);

  async function request(endpoint: string, pathname: string): Promise<unknown> {
    throwIfCancelled(opts.signal);
    await acquireSlot(db, endpoint, clock, mode, opts.onWait, opts.signal);
    // From here on the slot is consumed, whatever happens (429, network error, bad JSON).

    let res: ResponseLike;
    try {
      res = await doFetch(BASE_URL + pathname, {
        headers: { 'X-Token': token },
        signal: opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      if (opts.signal?.aborted) throw new SyncCancelledError();
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : 'unknown';
      throw new MonoApiError(redact(`Сетевая ошибка при запросе к Monobank (${endpoint}): ${reason}`), null);
    }

    if (res.status === 429) {
      // Push the shared slot forward: the next request waits a full period from now.
      await recordCall(db, endpoint, clock.nowMs());
      const retryAfter = Number(res.headers.get('retry-after'));
      const sec = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : RATE_LIMIT_MS / 1000;
      throw new RateLimitError(sec, 'server');
    }

    const text = await res.text().catch(() => '');
    throwIfCancelled(opts.signal);
    if (!res.ok) {
      let description = '';
      try {
        const body: unknown = JSON.parse(text);
        if (body && typeof body === 'object' && 'errorDescription' in body) {
          description = String((body as { errorDescription: unknown }).errorDescription).slice(0, 200);
        }
      } catch {
        // non-JSON body: don't echo it
      }
      const hint = res.status === 401 || res.status === 403 ? ' Проверь MONO_TOKEN.' : '';
      throw new MonoApiError(
        redact(`Monobank ответил ${res.status} на ${endpoint}${description ? `: ${description}` : ''}.${hint}`),
        res.status,
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new MonoApiError(`Monobank вернул не-JSON ответ на ${endpoint}`, res.status);
    }
  }

  function invalidFormat(endpoint: string, error: z.ZodError): MonoApiError {
    const where = error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(root)'} (${i.code})`) // field + issue code only, never values
      .join('; ');
    return new MonoApiError(`Неожиданный формат ответа ${endpoint}: ${where}`, 200);
  }

  return {
    async clientInfo() {
      const endpoint = '/personal/client-info';
      const json = await request(endpoint, endpoint);
      const parsed = ClientInfoSchema.safeParse(json);
      if (!parsed.success) throw invalidFormat(endpoint, parsed.error);
      return parsed.data;
    },

    async statement(accountId, from, to) {
      const endpoint = '/personal/statement';
      const json = await request(
        endpoint,
        `${endpoint}/${encodeURIComponent(accountId)}/${Math.floor(from)}/${Math.floor(to)}`,
      );
      if (!Array.isArray(json)) {
        throw new MonoApiError(`Неожиданный формат ответа ${endpoint}: ожидался массив`, 200);
      }
      return json.map((raw: unknown, i) => {
        const parsed = StatementItemSchema.safeParse(raw);
        if (!parsed.success) {
          const fields = [...new Set(parsed.error.issues.map((iss) => iss.path.join('.') || '(root)'))];
          const id = raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string' ? raw.id : null;
          throw new StatementFormatError(fields, id, i);
        }
        return { ...parsed.data, raw: JSON.stringify(raw) };
      });
    },
  };
}

// ---------- rate limiter (shared across processes via the api_calls table) ----------

async function recordCall(db: Db, endpoint: string, atMs: number): Promise<void> {
  await db.execute({ sql: 'INSERT INTO api_calls (endpoint, called_at) VALUES (?, ?)', args: [endpoint, atMs] });
}

/** Milliseconds until the shared slot frees up (0 = free now). */
export async function msUntilSlotFree(db: Db, nowMs: number): Promise<number> {
  const rs = await db.execute('SELECT MAX(called_at) AS last FROM api_calls');
  const last = rs.rows[0]?.last;
  if (last === null || last === undefined) return 0;
  return Math.max(0, Number(last) + RATE_LIMIT_MS - nowMs);
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
  onWait?: (waitMs: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  for (;;) {
    const now = clock.nowMs();
    const rs = await db.execute({
      sql: `INSERT INTO api_calls (endpoint, called_at)
            SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM api_calls WHERE called_at > ?)`,
      args: [endpoint, now, now - RATE_LIMIT_MS],
    });
    if (rs.rowsAffected === 1) {
      await db.execute({ sql: 'DELETE FROM api_calls WHERE called_at < ?', args: [now - 86_400_000] });
      return;
    }
    const waitMs = Math.max(1, await msUntilSlotFree(db, now));
    if (mode === 'fail') throw new RateLimitError(Math.ceil(waitMs / 1000), 'local');
    onWait?.(waitMs);
    await cancellableSleep(clock, waitMs, signal);
  }
}
