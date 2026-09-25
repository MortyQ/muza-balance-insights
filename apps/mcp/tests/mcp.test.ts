import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Db } from '../src/db.ts';
import { openDb } from '../src/db.ts';
import { displayCounterName, kyivStartOfDay } from '@mono/core/format';
import { createServer } from '../src/mcp/tools.ts';
import { createMonoClient } from '@mono/core/providers/monobank/client';
import { MCP_ROOT } from '../src/paths.ts';
import { TEST_TOKEN, fakeClock, fakeMonobank, item, memoryDb } from '@mono/core/test-helpers';

// Values that must never appear in any tool answer. `description` may appear only in search_transactions (as the merchant).
const CANARY = {
  counterName: 'Canary Mcpenko',
  description: 'Canary Mcp Shop',
  comment: 'canary mcp comment',
  iban: 'UA00CANARYMCPIBAN01',
  pan: '537541******3131',
  jarTitle: 'CanaryMcpJar',
};
const NEVER = Object.entries(CANARY).filter(([k]) => k !== 'description').map(([, v]) => v);

const NOW_SEC = kyivStartOfDay('2026-03-15') + 12 * 3600;
const SYNCED = kyivStartOfDay('2026-03-10') + 23 * 3600;

async function seed(db: Db): Promise<void> {
  await db.execute({
    sql: `INSERT INTO accounts (id, kind, type, currency_code, iban, masked_pan, balance, credit_limit, updated_at)
          VALUES ('black', 'card', 'black', 980, ?, ?, 19000000, 20000000, ?)`,
    args: [CANARY.iban, JSON.stringify([CANARY.pan]), SYNCED],
  });
  await db.execute({ sql: `INSERT INTO accounts (id, kind, type, currency_code, balance, credit_limit, updated_at) VALUES ('fopusd', 'card', 'fop', 840, 4200, 0, ?)`, args: [SYNCED] });
  await db.execute({ sql: `INSERT INTO accounts (id, kind, currency_code, title, balance, updated_at) VALUES ('jar', 'jar', 980, ?, 50000, ?)`, args: [CANARY.jarTitle, SYNCED] });
  for (const id of ['black', 'fopusd', 'jar']) {
    await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: [id, kyivStartOfDay('2026-01-01'), SYNCED, SYNCED] });
  }
  let n = 0;
  const tx = (account: string, date: string, amount: number, category: string, o: { mcc?: number; scope?: string; description?: string; counterName?: string } = {}) =>
    db.execute({
      sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount, currency_code,
              comment, counter_name, category, scope, raw_json, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, (SELECT currency_code FROM accounts WHERE id = ?), ?, ?, ?, ?, '{}', 0)`,
      args: [`t${++n}`, account, kyivStartOfDay(date) + 3600, date, o.description ?? CANARY.description, o.mcc ?? 5411, amount, amount,
        account, CANARY.comment, o.counterName ?? CANARY.counterName, category, o.scope ?? 'personal'],
    });
  await tx('black', '2026-02-03', -123_456, 'продукты');
  await tx('black', '2026-02-10', -20_000, 'переводы людям', { mcc: 4829 });
  await tx('black', '2026-03-02', -150_000, 'продукты');
  await tx('black', '2026-03-05', 700_000, 'поступления', { mcc: 4829, description: `Від: ${CANARY.counterName}` });
  await tx('fopusd', '2026-02-20', 100_000, 'поступления', { mcc: 4829, scope: 'business' });
}

function json(res: Awaited<ReturnType<Client['callTool']>>): any {
  const text = (res.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
  return res.isError ? { error: text } : JSON.parse(text);
}

function assertNoCanary(res: unknown, allowDescription = false) {
  const text = JSON.stringify(res);
  expect(NEVER.filter((c) => text.includes(c))).toEqual([]);
  if (!allowDescription) expect(text).not.toContain(CANARY.description);
}

describe('MCP tools (in-memory client)', () => {
  let db: Db;
  let client: Client;
  let mono: ReturnType<typeof fakeMonobank>;

  beforeEach(async () => {
    db = await memoryDb();
    await seed(db);
    const clock = fakeClock(NOW_SEC * 1000);
    mono = fakeMonobank({ statements: { black: [item('new1', NOW_SEC - 3600, -5_000)] } });
    const server = createServer({
      db,
      clock,
      getApi: () => createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: 'fail' }),
    });
    const [a, b] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '1' });
    await Promise.all([server.connect(a), client.connect(b)]);
  });

  afterEach(async () => {
    await client.close();
    db.close();
  });

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await client.callTool({ name, arguments: args });
    assertNoCanary(res, name === 'search_transactions');
    return json(res);
  };

  it('lists seven tools; each description says when to use it, the date format and what it does NOT do', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ['compare_periods', 'get_balances', 'get_sync_status', 'income_summary', 'search_transactions', 'spending_summary', 'sync_recent'].sort(),
    );
    for (const t of tools) {
      expect(t.description, t.name).toMatch(/Используй/);
      expect(t.description, t.name).toMatch(/НЕ делает/);
    }
    for (const name of ['spending_summary', 'compare_periods', 'income_summary', 'search_transactions']) {
      expect(tools.find((t) => t.name === name)?.description).toMatch(/YYYY-MM-DD.*включительно/);
    }
    for (const name of ['spending_summary', 'compare_periods', 'search_transactions']) {
      expect(tools.find((t) => t.name === name)?.description, name).toMatch(/поездках и странах.*operation_currency.*страну API не отдаёт/s);
    }
    expect(tools.find((t) => t.name === 'sync_recent')?.annotations?.readOnlyHint).toBe(false);
    expect(tools.find((t) => t.name === 'get_balances')?.annotations?.readOnlyHint).toBe(true);
  });

  it('spending_summary: amounts in hryvnias with currency, period block, notes', async () => {
    const r = await call('spending_summary', { from: '2026-02-01', to: '2026-02-28' });
    expect(r.period).toEqual({ from: '2026-02-01', to: '2026-02-28', days: 28, incomplete: false, data_until: '2026-03-10', covered_days: 28, pending_holds: 0 });
    const op = (net: number) => ({ operation: { currency: 'UAH', gross: net, refunds: 0, net } });
    expect(r.groups).toEqual([
      { currency: 'UAH', key: 'продукты', lines: 1, gross: 1234.56, refunds: 0, net: 1234.56, net_per_day: 44.09, ...op(1234.56) },
      { currency: 'UAH', key: 'переводы людям', lines: 1, gross: 200, refunds: 0, net: 200, net_per_day: 7.14, ...op(200) },
    ]);
    expect(r.totals).toEqual([{ currency: 'UAH', lines: 2, gross: 1434.56, refunds: 0, net: 1434.56, net_per_day: 51.23, ...op(1434.56) }]);
    expect(r.notes.join('\n')).toMatch(/Последняя синхронизация 109 ч назад/);
  });

  it('an incomplete period is flagged in period and notes; bad input comes back as a tool error', async () => {
    const r = await call('spending_summary', { from: '2026-03-01', to: '2026-03-31', group_by: 'month' });
    expect(r.period).toMatchObject({ incomplete: true, covered_days: 9 });
    expect(r.notes[0]).toMatch(/неполный/);
    expect((await call('spending_summary', { from: '2026-03-31', to: '2026-03-01' })).error).toMatch(/позже/);
    const bad = await client.callTool({ name: 'spending_summary', arguments: { from: '01.03.2026', to: '2026-03-31' } });
    expect(bad.isError).toBe(true);
  });

  it('compare_periods, income_summary (no sender names), get_balances (own funds first)', async () => {
    const c = await call('compare_periods', { a_from: '2026-02-01', a_to: '2026-02-28', b_from: '2026-03-01', b_to: '2026-03-31' });
    expect(c.totals).toEqual([{ currency: 'UAH', a: 1434.56, b: 1500, diff: 65.44, diff_pct: 4.6, a_per_day: 51.23, b_per_day: 166.67 }]);
    expect(c.notes.join('\n')).toMatch(/a_per_day против b_per_day/);

    const i = await call('income_summary', { from: '2026-01-01', to: '2026-03-31' });
    expect(i.groups.map((g: any) => [g.currency, g.key, g.total])).toEqual([['USD', 'transfer', 1000], ['UAH', 'named_sender', 7000]]);
    expect(i.notes.join('\n')).toMatch(/не складывай/);

    const b = await call('get_balances');
    expect(b.accounts[0]).toMatchObject({ id: 'fopusd', account: 'fop/USD', currency: 'USD', own_funds: 42 });
    expect(b.accounts.find((a: any) => a.id === 'black')).toMatchObject({ own_funds: -10000, credit_limit: 200000, available: 190000 });
    expect(b.totals).toEqual([{ currency: 'USD', own_funds: 42 }, { currency: 'UAH', own_funds: -9500 }]);
  });

  it('get_sync_status gives today and coverage; sync_recent pulls new rows and reports the rate limit', async () => {
    const s = await call('get_sync_status');
    expect(s.today).toBe('2026-03-15');
    expect(s.data_until).toBe('2026-03-10');

    const r = await call('sync_recent');
    expect(r.results.find((x: any) => x.account_id === 'black')).toBeDefined();
    const statuses = r.results.map((x: any) => x.status);
    expect(statuses).toContain('synced');
    expect(statuses).toContain('rate-limited');
    expect(r.notes.join('\n')).toMatch(/Лимит Monobank/);
    expect(mono.calls.every((c) => c.token === TEST_TOKEN)).toBe(true);
    expect(JSON.stringify(r)).not.toContain(TEST_TOKEN);
  });
});

describe('a trip (Albania): operation currency and search', () => {
  let db: Db;
  let client: Client;

  // 14–18.02: purchases in ALL and EUR on the UAH card, a UAH booking the same days, a refund in ALL,
  // a transfer to a person, a «Від: …» credit, a jar top-up and a masked card number.
  async function tripTx(id: string, date: string, amount: number, o: { opAmount?: number; opCurrency?: number; mcc?: number; description: string; counterName?: string; category?: string }) {
    await db.execute({
      sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount, currency_code,
              counter_name, category, raw_json, synced_at)
            VALUES (?, 'black', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, '{}', 0)`,
      args: [id, kyivStartOfDay(date) + 12 * 3600, date, o.description, o.mcc ?? 5812, amount, o.opAmount ?? amount, o.opCurrency ?? 980,
        o.counterName ?? null, o.category ?? 'кафе и рестораны'],
    });
  }

  beforeEach(async () => {
    db = await memoryDb();
    await seed(db);
    await tripTx('al1', '2026-02-14', -45_000, { opAmount: -100_000, opCurrency: 8, description: 'Restorant BLLOKU' });
    await tripTx('al2', '2026-02-15', -90_000, { opAmount: -200_000, opCurrency: 8, mcc: 5411, description: 'SUPERMARKET Вигаданий', category: 'продукты' });
    await tripTx('al3', '2026-02-16', 45_000, { opAmount: 100_000, opCurrency: 8, description: 'Restorant BLLOKU' }); // refund
    await tripTx('me1', '2026-02-17', -52_000, { opAmount: -1_200, opCurrency: 978, description: 'Kotor Cafe' });
    await tripTx('ua1', '2026-02-15', -300_000, { mcc: 7011, description: 'Вигаданий Booking', category: 'путешествия' });
    await tripTx('p2p', '2026-02-16', -10_000, { mcc: 4829, description: 'Олена Тестова', counterName: 'Олена Тестова', category: 'переводы людям' });
    await tripTx('in1', '2026-02-16', 20_000, { mcc: 4829, description: 'Від: Петро Вигаданий', category: 'поступления' });
    await tripTx('card', '2026-02-17', -5_000, { mcc: 4829, description: '516824******4802', category: 'переводы людям' });
    await tripTx('jar1', '2026-02-18', -1_000, { mcc: 4829, description: CANARY.jarTitle, category: 'свои переводы' });
    // not MCC 4829: a transfer from another bank whose description is the sender's name
    await tripTx('bank', '2026-02-18', 30_000, { mcc: 6012, description: 'Іван Вигаданенко', counterName: 'Іван Вигаданенко', category: 'поступления' });
    const server = createServer({ db, clock: fakeClock(NOW_SEC * 1000), getApi: () => { throw new Error('no api'); } });
    const [a, b] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'trip', version: '1' });
    await Promise.all([server.connect(a), client.connect(b)]);
  });

  afterEach(async () => {
    await client.close();
    db.close();
  });

  const call = async (name: string, args: Record<string, unknown>) => {
    const res = await client.callTool({ name, arguments: args });
    assertNoCanary(res, name === 'search_transactions');
    return json(res);
  };
  const TRIP = { from: '2026-02-14', to: '2026-02-18' };

  it('spending_summary with operation_currency = ALL: debited hryvnias + lek, refund netted in both', async () => {
    const r = await call('spending_summary', { ...TRIP, operation_currency: 'ALL' });
    expect(r.filters).toMatchObject({ operationCurrency: 'ALL' });
    expect(r.totals).toEqual([
      { currency: 'UAH', lines: 3, gross: 1350, refunds: 450, net: 900, net_per_day: 180, operation: { currency: 'ALL', gross: 3000, refunds: 1000, net: 2000 } },
    ]);
    expect((await call('spending_summary', { ...TRIP, operation_currency: 'all' })).totals[0].net).toBe(900); // any case
    expect((await client.callTool({ name: 'spending_summary', arguments: { ...TRIP, operation_currency: 'XYZ' } })).isError).toBe(true);
  });

  it('group_by = operation_currency splits the trip into ALL / EUR / UAH; UAH bookings stay visible separately', async () => {
    const r = await call('spending_summary', { ...TRIP, group_by: 'operation_currency' });
    expect(r.groups.map((g: any) => [g.key, g.net, g.operation?.currency, g.operation?.net])).toEqual([
      ['UAH', 3150, 'UAH', 3150], // booking 3000 + transfers 100 + 50
      ['ALL', 900, 'ALL', 2000],
      ['EUR', 520, 'EUR', 12],
    ]);
    expect(r.totals[0].operation).toBeUndefined(); // several operation currencies are never summed

    // a category mixing ALL and EUR lines gets no operation block
    const byCat = await call('spending_summary', { ...TRIP });
    const cafe = byCat.groups.find((g: any) => g.key === 'кафе и рестораны');
    expect(cafe).toMatchObject({ net: 520 + 450 - 450 });
    expect(cafe.operation).toBeUndefined();
  });

  it('search_transactions: by operation currency, all totals over all matches, truncation flag', async () => {
    const r = await call('search_transactions', { ...TRIP, operation_currency: 'ALL', limit: 2 });
    expect(r.total).toBe(3);
    expect(r.truncated).toBe(true);
    expect(r.transactions).toEqual([
      { time: '2026-02-16 12:00', amount: 450, currency: 'UAH', operation_amount: 1000, operation_currency: 'ALL', merchant: 'Restorant BLLOKU', category: 'кафе и рестораны', mcc: 5812, account: 'black/UAH', scope: 'personal' },
      { time: '2026-02-15 12:00', amount: -900, currency: 'UAH', operation_amount: -2000, operation_currency: 'ALL', merchant: 'SUPERMARKET Вигаданий', category: 'продукты', mcc: 5411, account: 'black/UAH', scope: 'personal' },
    ]);
    expect(r.totals).toEqual([{ currency: 'UAH', lines: 3, debits: 1350, credits: 450 }]);
    expect(r.operation_totals).toEqual([{ currency: 'ALL', lines: 3, debits: 3000, credits: 1000 }]);
    expect(r.notes[0]).toMatch(/Показано 2 из 3/);
  });

  it('text search folds Cyrillic case in JS; amount bounds are in the account currency', async () => {
    // newest first; the «Від: Петро Вигаданий» credit matches by name but is shown masked
    expect((await call('search_transactions', { ...TRIP, text: 'вигаданий' })).transactions.map((t: any) => t.merchant)).toEqual([
      'Від: П. В.', 'SUPERMARKET Вигаданий', 'Вигаданий Booking',
    ]);
    expect((await call('search_transactions', { ...TRIP, text: 'ВИГАДАНИЙ BOOKING' })).total).toBe(1);
    expect((await call('search_transactions', { ...TRIP, min_amount: 500, max_amount: 3000 })).transactions.map((t: any) => t.amount)).toEqual([
      -520, -900, -3000,
    ]);
  });

  it('names are initials: a transfer to a person, «Від: …», a full-name query still matches; card numbers and jar titles hidden', async () => {
    const r = await call('search_transactions', { ...TRIP, text: 'олена тестова' });
    expect(r.transactions).toEqual([expect.objectContaining({ merchant: 'О. Т.', counterparty: 'О. Т.', amount: -100 })]);
    const all = await call('search_transactions', { ...TRIP, limit: 200 });
    const text = JSON.stringify(all);
    for (const leaked of ['Олена', 'Тестова', 'Петро', 'Іван', 'Вигаданенко', '516824', '4802', CANARY.jarTitle]) expect(text).not.toContain(leaked);
    const merchants = all.transactions.map((t: any) => t.merchant);
    expect(merchants).toContain('І. В.');
    expect(merchants).toContain('Від: П. В.');
    expect(merchants).toContain('[картка]');
    expect(merchants).toContain('банка');
  });

  it('reveal_full_names (a user setting, not a parameter) shows full names', async () => {
    await db.execute(`INSERT INTO settings (key, value) VALUES ('reveal_full_names', 'on')`);
    const r = json(await client.callTool({ name: 'search_transactions', arguments: { ...TRIP, text: 'олена' } }));
    expect(r.transactions[0]).toMatchObject({ merchant: 'Олена Тестова', counterparty: 'Олена Тестова' });
  });
});

describe('counter_name in tool answers', () => {
  it('masked to initials unless the user enabled reveal_full_names', () => {
    expect(displayCounterName('Олена Тестова', false)).toBe('О. Т.');
    expect(displayCounterName('ФОП Вигаданий Іван Петрович', false)).toBe('Ф. В. І.');
    expect(displayCounterName('ТОВ «Вигадана Страховка»', false)).toBe('Т. В. С.');
    expect(displayCounterName('  ', false)).toBeNull();
    expect(displayCounterName('Олена Тестова', true)).toBe('Олена Тестова');
  });
});

describe('MCP server over stdio (real process, same entry wiring)', () => {
  it('starts from any cwd with an absolute tsx loader path, lists tools and answers a call', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-stdio-'));
    const dbPath = path.join(dir, 'test.db');
    const db = await openDb(`file:${dbPath}`);
    await seed(db);
    db.close();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        '--import', `file://${path.join(MCP_ROOT, 'node_modules', 'tsx', 'dist', 'loader.mjs')}`,
        path.join(MCP_ROOT, 'tests', 'fixtures', 'stdio-server.ts'),
        dbPath,
      ],
      cwd: dir,
      // Like Claude Desktop: a minimal environment. TMPDIR only so tsx can cache inside the test sandbox.
      env: { ...getDefaultEnvironment(), ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}) },
      stderr: 'pipe',
    });
    const client = new Client({ name: 'e2e', version: '1' });
    try {
      await client.connect(transport);
      expect((await client.listTools()).tools).toHaveLength(7);
      const r = json(await client.callTool({ name: 'spending_summary', arguments: { from: '2026-02-01', to: '2026-02-28' } }));
      expect(r.totals[0]).toMatchObject({ currency: 'UAH', net: 1434.56 });
      const sync = await client.callTool({ name: 'sync_recent', arguments: {} });
      expect(sync.isError).toBe(true);
      expect(json(sync).error).toMatch(/MONO_TOKEN/);
    } finally {
      await client.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
