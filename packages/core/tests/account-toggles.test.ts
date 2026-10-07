// The per-account toggle (migration v11, accounts.sync_choice): NULL = auto (a card always; a jar with balance > 0 or
// coverage), 1 / 0 = the user's choice. A disabled account is not imported and is in no statistic; a transfer between an
// enabled account and a disabled one is not internal: spending of the sender, income of the receiver. Fictional data only.
import { openLibsql } from '@mono/db-libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listConnectionAccounts, setAccountEnabled } from '../src/accounts.ts';
import { ConnectionError } from '../src/connections.ts';
import { MIGRATIONS, migrate, type Db } from '../src/db.ts';
import { kyivStartOfDay, toKyivDate } from '../src/format.ts';
import { exchangeRates } from '../src/fx.ts';
import { listConnections } from '../src/participants.ts';
import { createMonoClient } from '../src/providers/monobank/client.ts';
import { AUTO_TOPUP_DESCRIPTIONS, GENERIC_TRANSFER_DESCRIPTION, OWN_TRANSFER_DESCRIPTIONS } from '../src/providers/monobank/descriptions.ts';
import { monobankRules } from '../src/providers/monobank/rules.ts';
import { rederiveCore } from '../src/rederive.ts';
import { searchTransactions } from '../src/search.ts';
import { balancesAt, firstDataDate, getBalances, getSyncStatus } from '../src/status.ts';
import { comparePeriods, incomeSummary, periodInfo, spendingSummary } from '../src/summaries.ts';
import { defaultAccountSelection, planHistory, syncAccounts, type SyncContext } from '../src/sync.ts';
import { TEST_TOKEN, fakeClock, fakeMonobank, insertAccountRow, memoryDb, testConnection } from './helpers.ts';

let db: Db;
afterEach(() => db?.close());

const rows = async (sql: string) => (await db.execute(sql)).rows;

describe('migration v11', () => {
  it('adds accounts.sync_choice: NULL for existing accounts, only 0 or 1', async () => {
    db = await openLibsql(':memory:');
    const upTo10 = MIGRATIONS.filter((m) => m.version <= 10);
    for (const m of upTo10) await db.batch(m.statements.map((sql) => ({ sql, args: [] })));
    await db.execute('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)');
    for (const m of upTo10) await db.execute({ sql: 'INSERT INTO schema_migrations VALUES (?, ?, 0)', args: [m.version, m.name] });
    await db.execute(`INSERT INTO participants (id, label, created_at) VALUES (1, 'Я', 0)`);
    await db.execute(`INSERT INTO connections (id, participant_id, provider, created_at) VALUES (1, 1, 'monobank', 0)`);
    await db.execute(`INSERT INTO accounts (id, connection_id, kind, currency_code, balance, updated_at) VALUES ('a', 1, 'card', 980, 0, 0)`);

    expect(await migrate(db, 0)).toEqual([11, 12]);
    expect(await rows('SELECT id, sync_choice FROM accounts')).toEqual([{ id: 'a', sync_choice: null }]);
    await expect(db.execute(`UPDATE accounts SET sync_choice = 2 WHERE id = 'a'`)).rejects.toThrow(/CHECK/i);
  });
});

describe('the choice and the import plan', () => {
  const mono = () =>
    fakeMonobank({
      accounts: [{ id: 'card1' }, { id: 'card2' }],
      jars: [
        { id: 'jarFull', title: 'Вигадана повна', balance: 1000 },
        { id: 'jarEmpty', title: 'Вигадана порожня', balance: 0 },
      ],
    });
  const ctxFor = (m: ReturnType<typeof fakeMonobank>): SyncContext => {
    const clock = fakeClock();
    return { db, api: createMonoClient({ token: TEST_TOKEN, db, fetch: m.fetch, clock }), clock, warn: () => undefined };
  };

  beforeEach(async () => {
    db = await memoryDb();
  });

  it('auto: every card and a jar with money or coverage; the choice wins and survives syncAccounts', async () => {
    const ctx = ctxFor(mono());
    await syncAccounts(ctx);
    const conn = await testConnection(db);
    const view = async () => Object.fromEntries((await listConnectionAccounts(db, conn)).map((a) => [a.id, [a.enabled, a.auto]]));
    expect(await view()).toEqual({ card1: [true, true], card2: [true, true], jarFull: [true, true], jarEmpty: [false, true] });

    await db.execute(`INSERT INTO sync_state VALUES ('jarEmpty', 1, 2, 2)`);
    expect((await view()).jarEmpty).toEqual([true, true]);
    await db.execute(`DELETE FROM sync_state`);

    await setAccountEnabled(db, 'card2', false);
    await setAccountEnabled(db, 'jarEmpty', true);
    await syncAccounts(ctx);
    expect(await view()).toEqual({ card1: [true, true], card2: [false, false], jarFull: [true, true], jarEmpty: [true, false] });
    expect(await rows(`SELECT id, sync_choice FROM accounts ORDER BY id`)).toEqual([
      { id: 'card1', sync_choice: null }, { id: 'card2', sync_choice: 0 }, { id: 'jarEmpty', sync_choice: 1 }, { id: 'jarFull', sync_choice: null },
    ]);
  });

  it('the plan takes only enabled accounts; a disabled one is listed apart; explicit ids as before', async () => {
    const ctx = ctxFor(mono());
    await syncAccounts(ctx);
    await setAccountEnabled(db, 'card2', false);
    await setAccountEnabled(db, 'jarFull', false);
    expect(await defaultAccountSelection(db)).toEqual({
      selected: ['card1'],
      skippedJars: [{ id: 'jarEmpty', title: 'Вигадана порожня' }],
      disabled: ['card2', 'jarFull'],
    });
    const now = Math.floor(ctx.clock.nowMs() / 1000);
    expect([...(await planHistory(ctx, { sinceSec: now - 86_400 })).keys()]).toEqual(['card1']);
    expect([...(await planHistory(ctx, { sinceSec: now - 86_400, accountIds: ['card2'] })).keys()]).toEqual(['card2']);

    await setAccountEnabled(db, 'card2', true);
    expect((await defaultAccountSelection(db)).selected).toEqual(['card1', 'card2']);
  });

  it('unknown account → ConnectionError, nothing written', async () => {
    await syncAccounts(ctxFor(mono()));
    await expect(setAccountEnabled(db, 'nope', false)).rejects.toBeInstanceOf(ConnectionError);
    expect((await rows('SELECT COUNT(*) AS n FROM accounts WHERE sync_choice IS NOT NULL'))[0]?.n).toBe(0);
  });
});

describe('listConnectionAccounts', () => {
  it('what the toggle row shows — never an IBAN or a full card number', async () => {
    db = await memoryDb();
    const conn = await testConnection(db);
    await insertAccountRow(db, {
      id: 'black', kind: 'card', type: 'black', currency_code: 980, iban: 'UA00CANARYIBAN77', masked_pan: '["537541******7777"]',
      balance: 100, credit_limit: 0, updated_at: 0,
    });
    await insertAccountRow(db, { id: 'jar', kind: 'jar', currency_code: 840, title: 'Вигадана мрія', balance: 0, goal: 100, updated_at: 0 });
    await insertAccountRow(db, { id: 'nopan', kind: 'card', type: 'white', currency_code: 978, masked_pan: '[]', balance: 0, updated_at: 0 });
    const list = await listConnectionAccounts(db, conn);
    expect(list).toEqual([
      { id: 'black', kind: 'card', type: 'black', currencyCode: 980, maskedPanTail: '7777', jarTitle: null, enabled: true, auto: true },
      { id: 'nopan', kind: 'card', type: 'white', currencyCode: 978, maskedPanTail: null, jarTitle: null, enabled: true, auto: true },
      { id: 'jar', kind: 'jar', type: null, currencyCode: 840, maskedPanTail: null, jarTitle: 'Вигадана мрія', enabled: false, auto: true },
    ]);
    const text = JSON.stringify(list);
    for (const leak of ['UA00CANARYIBAN77', '537541', '******']) expect(text).not.toContain(leak);
    expect(await listConnectionAccounts(db, 999)).toEqual([]);
  });
});

describe('statistics without disabled accounts (variant A for transfers)', () => {
  let me: number;
  let her: number;
  const q = { from: '2026-02-01', to: '2026-02-28' };
  const NOW = kyivStartOfDay('2026-03-15');
  const SYNCED = kyivStartOfDay('2026-03-10');
  const T = kyivStartOfDay('2026-02-10') + 12 * 3600;

  const insertTx = (id: string, accountId: string, time: number, amount: number, mcc: number, description: string, o: { hold?: number; counterIban?: string } = {}) =>
    db.execute({
      sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code, counter_iban, raw_json, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 980, ?, '{}', 0)`,
      args: [id, accountId, time, toKyivDate(time), description, mcc, o.hold ?? 0, amount, o.counterIban ?? null],
    });
  const net = (s: { groups: Array<{ key: string; net: number }> }) => Object.fromEntries(s.groups.map((g) => [g.key, g.net]));
  const income = (s: { groups: Array<{ key: string; total: number }> }) => Object.fromEntries(s.groups.map((g) => [g.key, g.total]));

  beforeEach(async () => {
    db = await memoryDb();
    const meConn = await testConnection(db);
    me = Number((await db.execute({ sql: 'SELECT participant_id FROM connections WHERE id = ?', args: [meConn] })).rows[0]?.participant_id);
    her = Number((await db.execute(`INSERT INTO participants (label, created_at) VALUES ('Вигадана особа', 0) RETURNING id`)).rows[0]?.id);
    const herConn = Number(
      (await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id,
    );
    const card = (id: string, connection_id: number, iban: string, balance: number) =>
      insertAccountRow(db, { id, connection_id, kind: 'card', type: 'black', currency_code: 980, iban, balance, credit_limit: 0, updated_at: SYNCED });
    await card('black', meConn, 'UA00ME1', 100_000);
    await card('white', meConn, 'UA00ME2', 40_000);
    await card('her-black', herConn, 'UA00HER', 7_000);
    await db.execute({ sql: `INSERT INTO sync_state VALUES ('black', ?, ?, ?)`, args: [kyivStartOfDay('2026-01-01'), SYNCED, SYNCED] });
    await db.execute({ sql: `INSERT INTO sync_state VALUES ('her-black', ?, ?, ?)`, args: [kyivStartOfDay('2026-01-01'), SYNCED, SYNCED] });
    // white: imported from earlier and stale — it would pull data_until back if it counted.
    await db.execute({ sql: `INSERT INTO sync_state VALUES ('white', ?, ?, ?)`, args: [kyivStartOfDay('2025-12-01'), kyivStartOfDay('2026-02-20'), kyivStartOfDay('2026-02-20')] });

    await insertTx('food', 'black', T, -50_000, 5411, 'Вигаданий Магазин');
    await insertTx('w-food', 'white', T + 100, -20_000, 5411, 'Вигаданий Магазин');
    await insertTx('w-salary', 'white', T + 200, 70_000, 4829, 'Від: Вигадана Фірма');
    await insertTx('to-white', 'black', T + 1000, -10_000, 4829, 'Вигаданий переказ');
    await insertTx('from-black', 'white', T + 1002, 10_000, 4829, 'Вигаданий переказ');
    await insertTx('to-black', 'white', T + 2000, -5_000, 4829, 'Вигаданий переказ');
    await insertTx('from-white', 'black', T + 2003, 5_000, 4829, 'Вигаданий переказ');
    await insertTx('to-her', 'black', T + 3000, -3_000, 4829, 'Вигадана Особа');
    await insertTx('her-in', 'her-black', T + 3002, 3_000, 4829, 'Від: Вигаданий Я');
    await insertTx('w-to-her', 'white', T + 4000, -1_000, 4829, 'Вигадана Особа');
    await insertTx('her-in2', 'her-black', T + 4002, 1_000, 4829, 'Від: Вигаданий Я');
    await insertTx('to-her-iban', 'black', T + 5000, -2_000, 4829, 'Вигадана Особа', { counterIban: 'UA00HER' });
    await rederiveCore(db);
  });

  it('the fixture: pairs between my cards are internal, with her card family', async () => {
    const marks = await rows(`SELECT id, transfer_rule, is_internal_transfer FROM transactions WHERE transfer_rule IS NOT NULL ORDER BY id`);
    expect(marks.map((r) => [r.id, r.transfer_rule, r.is_internal_transfer])).toEqual([
      ['from-black', 'pair', 1], ['from-white', 'pair', 1], ['her-in', 'family', 0], ['her-in2', 'family', 0], ['to-black', 'pair', 1],
      ['to-her', 'family', 0], ['to-her-iban', 'family', 0], ['to-white', 'pair', 1], ['w-to-her', 'family', 0],
    ]);
  });

  it('all enabled: the numbers as before', async () => {
    expect(net(await spendingSummary(db, q, NOW))).toEqual({ продукты: 70_000 });
    expect(income(await incomeSummary(db, q, NOW))).toEqual({ named_sender: 70_000 });
    expect(net(await spendingSummary(db, { ...q, participantId: me }, NOW))).toEqual({ продукты: 70_000, семье: 6_000 });
  });

  it('a disabled card: its rows are gone; a transfer to it is spending, from it income — family and one person', async () => {
    await setAccountEnabled(db, 'white', false);
    expect(net(await spendingSummary(db, q, NOW))).toEqual({ продукты: 50_000, 'переводы людям': 10_000 });
    expect(income(await incomeSummary(db, q, NOW))).toEqual({ transfer: 5_000, named_sender: 1_000 });
    expect(net(await spendingSummary(db, { ...q, participantId: me }, NOW))).toEqual({ продукты: 50_000, 'переводы людям': 10_000, семье: 5_000 });
    expect(income(await incomeSummary(db, { ...q, participantId: me }, NOW))).toEqual({ transfer: 5_000 });
    expect(net(await spendingSummary(db, { ...q, accountId: 'white' }, NOW))).toEqual({});
    // Her side of a family transfer from the disabled card is an ordinary credit now, not a family transfer.
    expect(income(await incomeSummary(db, { ...q, participantId: her }, NOW))).toEqual({ family: 3_000, named_sender: 1_000 });

    const cmp = await comparePeriods(db, { a: { from: '2026-01-01', to: '2026-01-31' }, b: q }, NOW);
    expect(cmp.totals).toEqual([expect.objectContaining({ currency: 980, a: 0, b: 60_000 })]);
    // No rederive: the stored marks are what they were.
    expect((await rows(`SELECT category, is_internal_transfer FROM transactions WHERE id = 'to-white'`))[0]).toEqual({ category: 'свои переводы', is_internal_transfer: 1 });
  });

  it('a disabled card of another person: a family transfer to it is spending of the whole family too', async () => {
    await setAccountEnabled(db, 'her-black', false);
    // Pairs and the IBAN match alike: an ordinary transfer (its own category), no longer «семье».
    expect(net(await spendingSummary(db, q, NOW))).toEqual({ продукты: 70_000, 'переводы людям': 6_000 });
    expect(net(await spendingSummary(db, { ...q, participantId: me }, NOW))).toEqual({ продукты: 70_000, 'переводы людям': 6_000 });
    expect(income(await incomeSummary(db, q, NOW))).toEqual({ named_sender: 70_000 });
    expect(net(await spendingSummary(db, { ...q, participantId: her }, NOW))).toEqual({});
    expect(income(await incomeSummary(db, { ...q, participantId: her }, NOW))).toEqual({});
  });

  it('enabling it again brings everything back', async () => {
    await setAccountEnabled(db, 'white', false);
    await setAccountEnabled(db, 'white', true);
    expect(net(await spendingSummary(db, q, NOW))).toEqual({ продукты: 70_000 });
    expect(income(await incomeSummary(db, q, NOW))).toEqual({ named_sender: 70_000 });
    expect((await getBalances(db)).accounts.map((a) => a.id)).toEqual(['black', 'her-black', 'white']);
  });

  it('balances, balances at a date, sync status and coverage: enabled accounts only', async () => {
    await insertTx('w-hold', 'white', NOW - 3600, -100, 5411, 'Вигаданий Магазин', { hold: 1 });
    await setAccountEnabled(db, 'white', false);
    expect((await getBalances(db)).accounts.map((a) => a.id)).toEqual(['black', 'her-black']);
    expect((await getBalances(db)).totals).toEqual([{ currency: 980, own_funds: 107_000 }]);
    expect((await getBalances(db, { participantId: me })).accounts.map((a) => a.id)).toEqual(['black']);
    const at = await balancesAt(db, { endSec: kyivStartOfDay('2026-03-01') });
    expect(at.accounts.map((a) => a.id)).toEqual(['black', 'her-black']);

    const status = await getSyncStatus(db, NOW * 1000);
    expect(status.accounts.map((a) => a.id)).toEqual(['black', 'her-black']);
    expect(status.data_until).toBe('2026-03-10');
    expect(status.diagnostics.pending_holds).toBe(0);
    expect((await periodInfo(db, q, NOW)).dataUntil).toBe('2026-03-10');
    expect((await periodInfo(db, { from: '2026-03-01', to: '2026-03-31' }, NOW)).pendingHolds).toBe(0);
    expect(await firstDataDate(db)).toBe('2026-01-01');
    const mine = (await listConnections(db)).find((c) => c.participantId === me);
    expect(mine).toMatchObject({ accounts: 2, enabledAccounts: 1, coveredFrom: '2026-01-01', coveredTo: '2026-03-10' });

    await setAccountEnabled(db, 'white', true);
    expect((await getSyncStatus(db, NOW * 1000)).data_until).toBe('2026-02-20');
    expect(await firstDataDate(db)).toBe('2025-12-01');
    expect((await periodInfo(db, { from: '2026-03-01', to: '2026-03-31' }, NOW)).pendingHolds).toBe(1);
  });

  it('search: no rows of a disabled account; a transfer to it is not internal and has its ordinary category', async () => {
    await setAccountEnabled(db, 'white', false);
    const all = await searchTransactions(db, q, NOW);
    expect(all.transactions.map((t) => t.id).sort()).toEqual(['food', 'from-white', 'her-in', 'her-in2', 'to-her', 'to-her-iban', 'to-white']);
    expect(all.transactions.find((t) => t.id === 'to-white')).toMatchObject({ internal: false, category: 'переводы людям' });
    expect(all.transactions.find((t) => t.id === 'from-white')).toMatchObject({ internal: false, category: 'поступления' });
    const p2p = await searchTransactions(db, { ...q, category: 'переводы людям' }, NOW);
    expect(p2p.transactions.map((t) => t.id)).toEqual(['to-white']);
    expect((await searchTransactions(db, { ...q, category: 'свои переводы' }, NOW)).total).toBe(0);
  });

  it('both sides disabled: the pair vanishes; her side of a transfer from them is an ordinary credit', async () => {
    await setAccountEnabled(db, 'white', false);
    await setAccountEnabled(db, 'black', false);
    expect(net(await spendingSummary(db, q, NOW))).toEqual({});
    expect(income(await incomeSummary(db, q, NOW))).toEqual({ named_sender: 4_000 });
    expect((await searchTransactions(db, q, NOW)).transactions.map((t) => t.id).sort()).toEqual(['her-in', 'her-in2']);
  });

  it('a cancelled crossing row counts nowhere; a crossing hold counts like any hold', async () => {
    await insertTx('hold-out', 'black', T + 6000, -7_000, 4829, 'Вигаданий переказ', { hold: 1 });
    await insertTx('hold-in', 'white', T + 6002, 7_000, 4829, 'Вигаданий переказ', { hold: 1 });
    await rederiveCore(db);
    expect((await rows(`SELECT transfer_pair_id FROM transactions WHERE id = 'hold-out'`))[0]?.transfer_pair_id).toBe('hold-in');
    // Cancelled after the marks were made: the stored pair stays, the row must still count nowhere.
    await db.execute(`UPDATE transactions SET is_cancelled = 1 WHERE id = 'to-white'`);
    await setAccountEnabled(db, 'white', false);
    expect(net(await spendingSummary(db, q, NOW))).toEqual({ продукты: 50_000, 'переводы людям': 7_000 });
    expect((await searchTransactions(db, q, NOW)).transactions.map((t) => t.id)).not.toContain('to-white');
  });

  it('a category override applies to a crossing row as to any ordinary operation', async () => {
    await db.execute(`UPDATE transactions SET counter_name = 'Вигаданий Отримувач' WHERE id = 'to-white'`);
    await db.execute(`INSERT INTO category_overrides (pattern, match_type, category) VALUES ('Вигаданий Отримувач', 'exact', 'цветы и подарки')`);
    await rederiveCore(db);
    expect((await rows(`SELECT category FROM transactions WHERE id = 'to-white'`))[0]?.category).toBe('свои переводы');
    await setAccountEnabled(db, 'white', false);
    expect(net(await spendingSummary(db, q, NOW))).toEqual({ продукты: 50_000, 'цветы и подарки': 10_000 });
  });
});

describe('transfers made after the toggle: no pair, marked `text` by the provider rule', () => {
  const q = { from: '2026-02-01', to: '2026-02-28' };
  const NOW = kyivStartOfDay('2026-03-15');
  const T = kyivStartOfDay('2026-02-10') + 12 * 3600;
  let seq = 0;
  const tx = (id: string, accountId: string, amount: number, description: string) =>
    db.execute({
      sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code, raw_json, synced_at)
            VALUES (?, ?, ?, '2026-02-10', ?, 4829, 0, ?, 980, '{}', 0)`,
      args: [id, accountId, T + 1000 * ++seq, description, amount],
    });
  const net = (s: { groups: Array<{ key: string; net: number }> }) => Object.fromEntries(s.groups.map((g) => [g.key, g.net]));

  beforeEach(async () => {
    seq = 0;
    db = await memoryDb();
    const card = (id: string, type: string, currency: number) =>
      insertAccountRow(db, { id, kind: 'card', type, currency_code: currency, balance: 0, credit_limit: 0, updated_at: 0 });
    await card('black', 'black', 980);
    await card('usdblack', 'black', 840);
    await card('white', 'white', 980);
    await card('fop', 'fop', 980);
    await insertAccountRow(db, { id: 'jarOff', kind: 'jar', currency_code: 980, title: 'Вигадана мрія', balance: 100, updated_at: 0 });
    await insertAccountRow(db, { id: 'jarOn', kind: 'jar', currency_code: 980, title: 'Вигадана друга', balance: 100, updated_at: 0 });
    await tx('r-jar-tpl', 'black', -1_000, 'Регулярне поповнення «Вигадана мрія»');
    await tx('r-jar-title', 'black', -2_000, 'Вигадана мрія');
    await tx('r-jar-on', 'black', -4_000, 'Регулярне поповнення «Вигадана друга»');
    await tx('r-white', 'black', -8_000, 'На білу картку');
    await tx('r-fop', 'black', 16_000, 'З гривневого рахунку ФОП');
    await tx('r-black-amb', 'jarOn', 32_000, 'З Чорної картки');
    await tx('r-topup', 'jarOn', 64_000, '10%');
    await rederiveCore(db);
    for (const id of ['white', 'fop', 'usdblack', 'jarOff']) await setAccountEnabled(db, id, false);
  });

  it('the fixture: every row is a single-row own transfer (text)', async () => {
    const marks = await rows(`SELECT DISTINCT transfer_rule, transfer_pair_id, is_internal_transfer FROM transactions`);
    expect(marks).toEqual([{ transfer_rule: 'text', transfer_pair_id: null, is_internal_transfer: 1 }]);
  });

  it('a text that names a disabled jar (template or title), card type or FOP account: an ordinary operation', async () => {
    expect(net(await spendingSummary(db, q, NOW))).toEqual({ 'переводы людям': 11_000 });
    const inc = await incomeSummary(db, q, NOW);
    expect(inc.groups.map((g) => [g.key, g.total])).toEqual([['transfer', 16_000]]);
    const found = await searchTransactions(db, { ...q, category: 'свои переводы' }, NOW);
    expect(found.transactions.map((t) => t.id).sort()).toEqual(['r-black-amb', 'r-jar-on', 'r-topup']);
  });

  it('documented limits: an enabled counterpart, an ambiguous one (a black card enabled, another not) or none named stay internal', async () => {
    // r-jar-on: the jar is enabled. r-black-amb: «З Чорної картки» fits black (on) and usdblack (off). r-topup: «10%» names no card.
    const s = await searchTransactions(db, q, NOW);
    expect(Object.fromEntries(s.transactions.map((t) => [t.id, t.internal]))).toEqual({
      'r-jar-tpl': false, 'r-jar-title': false, 'r-jar-on': true, 'r-white': false, 'r-fop': false, 'r-black-amb': true, 'r-topup': true,
    });
    // Once no enabled black card is left, the black text is unambiguous too.
    await setAccountEnabled(db, 'black', false);
    const after = await searchTransactions(db, q, NOW);
    expect(after.transactions.find((t) => t.id === 'r-black-amb')).toMatchObject({ internal: false, category: 'поступления' });
  });
});

describe('monobank ownTransferCounterpart (pure)', () => {
  const ctx = { jarTitles: new Set(['Вигадана мрія']) };
  const of = (description: string) => monobankRules.ownTransferCounterpart({ description, mcc: 4829, amount: -1 }, ctx);

  it('every own-transfer text names the other side; jar templates and titles name the jar', () => {
    for (const d of OWN_TRANSFER_DESCRIPTIONS) expect(of(d)).toMatchObject({ kind: 'card' });
    expect(of('На білу картку')).toEqual({ kind: 'card', type: 'white', currencyCode: null });
    expect(of('З доларового рахунку ФОП для переказу на картку')).toEqual({ kind: 'card', type: 'fop', currencyCode: 840 });
    expect(of('Часткове зняття банки «Інша назва»')).toEqual({ kind: 'jar', title: 'Інша назва' });
    expect(of(' Вигадана мрія ')).toEqual({ kind: 'jar', title: 'Вигадана мрія' });
  });

  it('auto top-ups, the generic text and anything else name nothing', () => {
    for (const d of [...AUTO_TOPUP_DESCRIPTIONS, GENERIC_TRANSFER_DESCRIPTION, 'Вигаданий Магазин']) expect(of(d)).toBeNull();
    expect(monobankRules.ownTransferCounterpart({ description: 'На білу картку', mcc: 5411, amount: -1 }, ctx)).toBeNull();
  });
});

describe('exchange rates without disabled accounts', () => {
  const USD = 840;
  let seq = 0;
  const row = (accountId: string, date: string, amount: number, opCurrency: number, opAmount: number, pairId: string | null = null) =>
    db.execute({
      sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount, currency_code,
              transfer_rule, transfer_pair_id, is_internal_transfer, raw_json, synced_at) VALUES (?, ?, ?, ?, '', 4829, 0, ?, ?, ?, 'pair_fx', ?, 1, '{}', 0)`,
      args: [`fx${++seq}`, accountId, kyivStartOfDay(date) + 12 * 3600 + seq, date, amount, opAmount, opCurrency, pairId],
    });
  const SEP = { from: '2026-09-01', to: '2026-09-30' };

  beforeEach(async () => {
    seq = 0;
    db = await memoryDb();
    for (const [id, currency] of [['uah', 980], ['uah2', 980], ['usd', USD], ['usd2', USD]] as const) {
      await insertAccountRow(db, { id, kind: 'card', type: 'black', currency_code: currency, balance: 0, credit_limit: 0, updated_at: 0 });
    }
  });

  it('a disabled hryvnia account, or an exchange with a disabled account, is not a source', async () => {
    await row('uah', '2026-09-05', 400_000, USD, 10_000, 'fx2'); // 40.00, from usd
    await row('usd', '2026-09-05', -10_000, 980, -400_000, 'fx1');
    await row('uah2', '2026-09-06', 440_000, USD, 10_000, 'fx4'); // 44.00, from usd2
    await row('usd2', '2026-09-06', -10_000, 980, -440_000, 'fx3');
    expect((await exchangeRates(db, SEP)).get(USD)).toEqual({ rate: 42, nearest: false });
    await setAccountEnabled(db, 'uah2', false);
    expect((await exchangeRates(db, SEP)).get(USD)).toEqual({ rate: 40, nearest: false });
    await setAccountEnabled(db, 'uah2', true);
    await setAccountEnabled(db, 'usd', false);
    expect((await exchangeRates(db, SEP)).get(USD)).toEqual({ rate: 44, nearest: false });
  });
});
