// Monobank personal API client: requests, response schemas, the shared request slot, pages of a statement.
// The only Monobank code with network access; the sync loop sees it as a ProviderClient (providers/types.ts).
import { z } from 'zod';
import { SyncCancelledError, throwIfCancelled } from '../../cancel.ts';
import type { Db } from '../../db.ts';
import { RateLimitError, StatementFormatError } from '../../errors.ts';
import type { Clock, FetchLike, ResponseLike } from '../../platform.ts';
import { acquireSlot, recordCall, type RateLimitMode } from '../../ratelimit.ts';
import type { NormalizedAccount, NormalizedTx, ProviderClient } from '../types.ts';
import { RATE_LIMIT_MS, STATEMENT_PAGE_LIMIT } from './constants.ts';

export type { Clock } from '../../platform.ts';
export type { RateLimitMode } from '../../ratelimit.ts';
export { RateLimitError, StatementFormatError } from '../../errors.ts';

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
  clientId: z.string().optional(),
  name: z.string().optional(),
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
// RateLimitError and StatementFormatError are shared by every provider (src/errors.ts).

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

export type MonoClientOptions = {
  token: string;
  db: Db;
  fetch: FetchLike;
  clock: Clock;
  rateLimitMode?: RateLimitMode;
  /** The connection whose request slot this client uses; absent = the slot of calls without a connection (tests). */
  connectionId?: number;
  /** Called before sleeping for the rate limit (progress output). */
  onWait?: (waitMs: number) => void;
  /** Cancels waits and in-flight requests (SyncCancelledError). */
  signal?: AbortSignal;
};

export type MonoClient = ProviderClient & {
  clientInfo(): Promise<ClientInfo>;
  /** One raw statement request (no pagination). `from`/`to` are unix seconds. */
  statement(accountId: string, from: number, to: number): Promise<StatementItem[]>;
};

export function createMonoClient(opts: MonoClientOptions): MonoClient {
  const { token, db } = opts;
  const { fetch: doFetch, clock } = opts;
  const mode = opts.rateLimitMode ?? 'wait';
  const limit = { intervalMs: RATE_LIMIT_MS, bank: 'Monobank', connectionId: opts.connectionId ?? null };

  const redact = (s: string): string => (token ? s.split(token).join('***') : s);

  async function request(endpoint: string, pathname: string): Promise<unknown> {
    throwIfCancelled(opts.signal);
    await acquireSlot(db, endpoint, clock, mode, limit, opts.onWait, opts.signal);
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
      await recordCall(db, endpoint, clock.nowMs(), limit.connectionId);
      const retryAfter = Number(res.headers.get('retry-after'));
      const sec = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : RATE_LIMIT_MS / 1000;
      throw new RateLimitError(sec, 'server', limit.bank, RATE_LIMIT_MS / 1000);
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

  const client: MonoClient = {
    provider: 'monobank',

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

    async accounts() {
      const info = await client.clientInfo();
      return {
        externalClientId: info.clientId ?? null,
        holderName: info.name?.trim() || null,
        accounts: [...info.accounts.map(cardAccount), ...info.jars.map(jarAccount)],
      };
    },

    async statementWindow(accountId, w, onPage) {
      return fetchAllPages(client, accountId, w, onPage);
    },
  };
  return client;
}

function cardAccount(a: Card): NormalizedAccount {
  return {
    id: a.id, kind: 'card', type: a.type ?? null, currencyCode: a.currencyCode, iban: a.iban ?? null,
    maskedPan: a.maskedPan ?? null, title: null, goal: null, balance: a.balance, creditLimit: a.creditLimit ?? null,
  };
}

function jarAccount(j: Jar): NormalizedAccount {
  return {
    id: j.id, kind: 'jar', type: null, currencyCode: j.currencyCode, iban: null, maskedPan: null,
    title: j.title ?? null, goal: j.goal ?? null, balance: j.balance, creditLimit: null,
  };
}

/**
 * Every page of one window. Per the Monobank docs, items come newest first and a response of exactly 500 items
 * means "there may be more": repeat with `to` = time of the last (oldest) item until fewer than 500 come back.
 * Items at that boundary second come back twice → dedupe by id. Nothing is written: if any page fails, the whole
 * window is simply retried next time. A statement item already has the stored shape (NormalizedTx).
 */
async function fetchAllPages(
  client: MonoClient,
  accountId: string,
  w: { from: number; to: number },
  onPage?: (page: number, received: number) => void,
): Promise<NormalizedTx[]> {
  const byId = new Map<string, NormalizedTx>();
  let to = w.to;
  for (let page = 1; ; page++) {
    const items = await client.statement(accountId, w.from, to);
    for (const it of items) byId.set(it.id, it);
    onPage?.(page, items.length);
    if (items.length < STATEMENT_PAGE_LIMIT) break;
    // min() rather than items.at(-1): identical for newest-first order, and robust if it ever isn't.
    const oldest = Math.min(...items.map((i) => i.time));
    if (oldest >= to) {
      // ≥ 500 transactions within one second — paginating by time cannot make progress.
      throw new Error(`Пагинация не продвигается для счёта ${accountId}: ≥ ${STATEMENT_PAGE_LIMIT} транзакций в одну секунду`);
    }
    to = oldest;
  }
  return [...byId.values()];
}
