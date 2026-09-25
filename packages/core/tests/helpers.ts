import { openLibsql } from '@mono/db-libsql';
import { migrate, type Db } from '../src/db.ts';
import type { Clock } from '../src/platform.ts';

export const TEST_TOKEN = 'test-token-SHOULD-NEVER-LEAK-9f3a';

export type FakeClock = Clock & { sleeps: number[]; advance(ms: number): void };

export function fakeClock(startMs = Date.UTC(2025, 5, 15, 12, 0, 0)): FakeClock {
  let now = startMs;
  const sleeps: number[] = [];
  return {
    sleeps,
    nowMs: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
    advance: (ms) => {
      now += ms;
    },
  };
}

export type RawItem = {
  id: string;
  time: number;
  description?: string;
  mcc?: number;
  originalMcc?: number;
  hold?: boolean;
  amount: number;
  operationAmount?: number;
  currencyCode?: number;
  commissionRate?: number;
  cashbackAmount?: number;
  balance?: number;
  counterName?: string;
  counterIban?: string;
  comment?: string;
};

export function item(id: string, time: number, amount: number, extra: Partial<RawItem> = {}): RawItem {
  return {
    id,
    time,
    description: 'Shop',
    mcc: 5411,
    originalMcc: 5411,
    hold: false,
    amount,
    operationAmount: amount,
    currencyCode: 980,
    commissionRate: 0,
    cashbackAmount: 0,
    balance: 100_000,
    ...extra,
  };
}

export type Call = { url: string; token: string | null };

/**
 * A fake Monobank: serves /personal/client-info and /personal/statement from in-memory data,
 * returning items with from ≤ time ≤ to, newest first, truncated to `pageLimit`.
 */
export function fakeMonobank(opts: {
  accounts?: Array<{ id: string; currencyCode?: number; iban?: string }>;
  jars?: Array<{ id: string; title?: string; currencyCode?: number; balance?: number }>;
  statements?: Record<string, RawItem[]>;
  pageLimit?: number;
  /** Intercept a call (by 0-based index) — e.g. to simulate failures. */
  intercept?: (callIndex: number, url: string) => Response | Promise<Response> | 'throw' | undefined;
}) {
  const calls: Call[] = [];
  const pageLimit = opts.pageLimit ?? 500;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    calls.push({ url, token: headers.get('X-Token') });
    const custom = opts.intercept?.(calls.length - 1, url);
    if (custom === 'throw') throw new TypeError('fetch failed');
    if (custom) return custom;

    const path = new URL(url).pathname;
    if (path === '/personal/client-info') {
      return Response.json({
        clientId: 'c1',
        name: 'Test',
        accounts: (opts.accounts ?? []).map((a) => ({
          id: a.id,
          balance: 1000,
          creditLimit: 0,
          type: 'black',
          currencyCode: a.currencyCode ?? 980,
          maskedPan: ['537541******0000'],
          iban: a.iban ?? `UA00${a.id}`,
        })),
        jars: (opts.jars ?? []).map((j) => ({
          id: j.id,
          title: j.title ?? 'Jar',
          description: '',
          currencyCode: j.currencyCode ?? 980,
          balance: j.balance ?? 500,
          goal: null,
        })),
      });
    }
    const m = /^\/personal\/statement\/([^/]+)\/(\d+)\/(\d+)$/.exec(path);
    if (m) {
      const [, acc, from, to] = m;
      const items = (opts.statements?.[decodeURIComponent(acc ?? '')] ?? [])
        .filter((i) => i.time >= Number(from) && i.time <= Number(to))
        .sort((a, b) => b.time - a.time)
        .slice(0, pageLimit);
      return Response.json(items);
    }
    return Response.json({ errorDescription: 'not found' }, { status: 404 });
  };
  return { fetch: fetchImpl, calls };
}

/** A migrated database on the Node adapter. `url`: `:memory:` or `file:/abs/path.db`. */
export async function openTestDb(url: string): Promise<Db> {
  const db: Db = await openLibsql(url);
  await migrate(db, 0);
  return db;
}

export async function memoryDb(): Promise<Db> {
  return openTestDb(':memory:');
}

export async function insertAccount(db: Db, id: string, kind: 'card' | 'jar' = 'card', currency = 980, iban?: string) {
  await db.execute({
    sql: `INSERT INTO accounts (id, kind, currency_code, iban, balance, updated_at) VALUES (?, ?, ?, ?, 0, 0)`,
    args: [id, kind, currency, iban ?? null],
  });
}

export async function allTextInDb(db: Db): Promise<string> {
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  let out = '';
  for (const t of tables.rows) {
    const rs = await db.execute(`SELECT * FROM "${String(t.name)}"`);
    out += JSON.stringify(rs.rows);
  }
  return out;
}
