import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { categoryLines } from '../src/category-lines.ts';
import { incomeLines } from '../src/income-lines.ts';
import { kyivStartOfDay } from '../src/format.ts';
import { spendingByCategory } from '../src/queries.ts';
import { getBalances, getSyncStatus } from '../src/status.ts';
import {
  INCOME_GROUP_BY,
  SPENDING_GROUP_BY,
  SummaryError,
  comparePeriods,
  incomeSource,
  incomeSummary,
  periodInfo,
  spendingGrid,
  spendingSummary,
} from '../src/summaries.ts';
import { insertAccountRow, memoryDb } from './helpers.ts';

let db: Db;

// "Now" = 2026-03-15 12:00 Kyiv; data synced up to 2026-03-10 23:00 Kyiv.
const NOW = kyivStartOfDay('2026-03-15') + 12 * 3600;
const SYNCED_TO = kyivStartOfDay('2026-03-10') + 23 * 3600;

async function account(id: string, type: string | null, currency = 980, balance = 0, creditLimit = 0, extra: { iban?: string; pan?: string; title?: string } = {}) {
  await insertAccountRow(db, {
    id, kind: type === null ? 'jar' : 'card', type, currency_code: currency, iban: extra.iban ?? null, masked_pan: extra.pan ?? null,
    title: extra.title ?? null, balance, credit_limit: creditLimit, updated_at: SYNCED_TO,
  });
}

let seq = 0;
async function tx(
  accountId: string,
  date: string,
  amount: number,
  o: {
    category?: string; mcc?: number; scope?: string; internal?: boolean; commission?: number; hold?: boolean; description?: string;
    cancelled?: boolean; opCurrency?: number; opAmount?: number;
  } = {},
) {
  const id = `t${++seq}`;
  // Operation currency defaults to the account currency, as for most real rows.
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount, currency_code,
            commission_rate, category, is_internal_transfer, scope, is_cancelled, raw_json, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, (SELECT currency_code FROM accounts WHERE id = ?)), ?, ?, ?, ?, ?, '{}', 0)`,
    args: [
      id, accountId, kyivStartOfDay(date) + 3600, date, o.description ?? '', o.mcc ?? 5411, o.hold ? 1 : 0, amount, o.opAmount ?? amount,
      o.opCurrency ?? null, accountId, o.commission ?? 0, o.category ?? 'продукты', o.internal ? 1 : 0, o.scope ?? 'personal', o.cancelled ? 1 : 0,
    ],
  });
  return id;
}

async function synced(accountId: string, newest = SYNCED_TO) {
  await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: [accountId, kyivStartOfDay('2026-01-01'), newest, newest] });
}

beforeEach(async () => {
  seq = 0;
  db = await memoryDb();
  await account('black', 'black', 980, 19_000_000, 20_000_000, { iban: 'UA00CANARYIBAN77', pan: '537541******7777' });
  await account('fop', 'fop', 980, 50_000);
  await account('usd', 'black', 840, 1_000);
  await account('jar', null, 980, 30_000, 0, { title: 'CanaryJarTitle77' });
  await account('emptyjar', null, 980, 0);
  for (const id of ['black', 'fop', 'usd', 'jar']) await synced(id);
});

afterEach(() => db.close());

describe('periodInfo', () => {
  it('complete when the period ends before the last sync; covered days = all days', async () => {
    expect(await periodInfo(db, { from: '2026-02-01', to: '2026-02-28' }, NOW)).toEqual({
      from: '2026-02-01', to: '2026-02-28', days: 28, incomplete: false, dataUntil: '2026-03-10', coveredDays: 28, pendingHolds: 0,
    });
  });

  it('incomplete when the period ends after the last sync or in the future; averages use covered days', async () => {
    const march = await periodInfo(db, { from: '2026-03-01', to: '2026-03-31' }, NOW);
    expect(march).toMatchObject({ days: 31, incomplete: true, dataUntil: '2026-03-10', coveredDays: 9 }); // 10.03 synced only till 23:00
    // the sync day itself: the period ends at midnight after the last synced second → incomplete
    expect((await periodInfo(db, { from: '2026-03-10', to: '2026-03-10' }, NOW)).incomplete).toBe(true);
    expect((await periodInfo(db, { from: '2026-03-09', to: '2026-03-09' }, NOW)).incomplete).toBe(false);
    // synced through the last second of a day → that day is fully covered
    await db.execute({ sql: 'UPDATE sync_state SET newest_synced_time = ?', args: [kyivStartOfDay('2026-03-11') - 1] });
    expect(await periodInfo(db, { from: '2026-03-01', to: '2026-03-31' }, NOW)).toMatchObject({ dataUntil: '2026-03-10', coveredDays: 10 });
    expect(await periodInfo(db, { from: '2026-04-01', to: '2026-04-30' }, NOW)).toMatchObject({ incomplete: true, coveredDays: 0 });
  });

  it('the least recent account defines dataUntil; nothing synced → incomplete, no covered days', async () => {
    await db.execute({ sql: 'UPDATE sync_state SET newest_synced_time = ? WHERE account_id = ?', args: [kyivStartOfDay('2026-03-05') + 60, 'usd'] });
    expect((await periodInfo(db, { from: '2026-03-01', to: '2026-03-31' }, NOW)).dataUntil).toBe('2026-03-05');
    await db.execute('DELETE FROM sync_state');
    expect(await periodInfo(db, { from: '2026-02-01', to: '2026-02-28' }, NOW)).toMatchObject({ incomplete: true, dataUntil: null, coveredDays: 0 });
  });

  it('rejects bad dates and reversed periods; pending holds = only the last 3 days, not cancelled', async () => {
    await expect(periodInfo(db, { from: '2026-02-30', to: '2026-03-01' }, NOW)).rejects.toThrow(SummaryError);
    await expect(periodInfo(db, { from: '2026-03-02', to: '2026-03-01' }, NOW)).rejects.toThrow(SummaryError);
    await tx('black', '2026-02-10', -100, { hold: true }); // older than 3 days: final
    await tx('black', '2026-03-13', -100, { hold: true });
    await tx('black', '2026-03-14', -100, { hold: true, cancelled: true });
    expect((await periodInfo(db, { from: '2026-02-01', to: '2026-03-31' }, NOW)).pendingHolds).toBe(1);
  });
});

describe('spendingSummary', () => {
  beforeEach(async () => {
    await tx('black', '2026-01-05', -10_000, { category: 'продукты' });
    await tx('black', '2026-01-20', -4_000, { category: 'кафе и рестораны', mcc: 5812 });
    await tx('black', '2026-01-21', 1_000, { category: 'кафе и рестораны', mcc: 5812 }); // refund
    await tx('black', '2026-02-03', -20_400, { category: 'переводы людям', mcc: 4829, commission: 400 });
    await tx('black', '2026-02-04', -50_000, { category: 'свои переводы', mcc: 4829, internal: true, commission: 2_000 });
    await tx('black', '2026-02-05', 30_000, { category: 'поступления', mcc: 4829 });
    await tx('fop', '2026-02-06', -7_000, { category: 'налоги и госплатежи', mcc: 4829, scope: 'business' });
    await tx('usd', '2026-02-07', -500, { category: 'путешествия', mcc: 4722 });
    await tx('black', '2026-02-08', -999, { category: 'продукты', cancelled: true });
  });

  const Q = { from: '2026-01-01', to: '2026-02-28' };

  it('by category: commission split, internal body excluded, refunds netted, income/own excluded, currencies apart', async () => {
    const s = await spendingSummary(db, Q, NOW);
    expect(s.period).toMatchObject({ days: 59, incomplete: false, coveredDays: 59 });
    expect(s.groups.map(({ currency, key, lines, gross, refunds, net }) => ({ currency, key, lines, gross, refunds, net }))).toEqual([
      { currency: 840, key: 'путешествия', lines: 1, gross: 500, refunds: 0, net: 500 },
      { currency: 980, key: 'переводы людям', lines: 1, gross: 20_000, refunds: 0, net: 20_000 },
      { currency: 980, key: 'продукты', lines: 1, gross: 10_000, refunds: 0, net: 10_000 },
      { currency: 980, key: 'налоги и госплатежи', lines: 1, gross: 7_000, refunds: 0, net: 7_000 },
      { currency: 980, key: 'кафе и рестораны', lines: 2, gross: 4_000, refunds: 1_000, net: 3_000 },
      { currency: 980, key: 'комиссии банка', lines: 2, gross: 2_400, refunds: 0, net: 2_400 },
    ]);
    expect(s.totals).toEqual([
      // one operation currency → the operation block is kept; UAH mixes in commissions (no operation currency) → dropped
      { currency: 840, lines: 1, purchases: 1, gross: 500, refunds: 0, net: 500, netPerDay: 8, operation: { currency: 840, gross: 500, refunds: 0, net: 500 } },
      { currency: 980, lines: 7, purchases: 6, gross: 43_400, refunds: 1_000, net: 42_400, netPerDay: 719 },
    ]);
  });

  it('purchases: spending lines only — a refund is not an operation, a commission line is one', async () => {
    const s = await spendingSummary(db, Q, NOW);
    expect(s.groups.map(({ currency, key, lines, purchases }) => ({ currency, key, lines, purchases }))).toEqual([
      { currency: 840, key: 'путешествия', lines: 1, purchases: 1 },
      { currency: 980, key: 'переводы людям', lines: 1, purchases: 1 },
      { currency: 980, key: 'продукты', lines: 1, purchases: 1 },
      { currency: 980, key: 'налоги и госплатежи', lines: 1, purchases: 1 },
      { currency: 980, key: 'кафе и рестораны', lines: 2, purchases: 1 },
      { currency: 980, key: 'комиссии банка', lines: 2, purchases: 2 },
    ]);
    expect(s.totals.map(({ currency, purchases }) => ({ currency, purchases }))).toEqual([
      { currency: 840, purchases: 1 },
      { currency: 980, purchases: 6 },
    ]);
  });

  it('every groupBy gives the same totals (no line lost or doubled)', async () => {
    const base = (await spendingSummary(db, Q, NOW)).totals;
    for (const groupBy of SPENDING_GROUP_BY) {
      expect((await spendingSummary(db, { ...Q, groupBy }, NOW)).totals, groupBy).toEqual(base);
    }
  });

  it('categoryLines: the lines behind every category figure sum to it (net, gross, refunds, purchases), in any scope', async () => {
    for (const scope of [undefined, 'personal', 'business'] as const) {
      const f = scope ? { scope } : {};
      for (const g of (await spendingSummary(db, { ...Q, ...f }, NOW)).groups) {
        const lines = (await categoryLines(db, { ...Q, ...f, category: g.key }, NOW)).lines.filter((l) => l.currency === g.currency);
        const gross = lines.filter((l) => l.amount < 0).reduce((s, l) => s - l.amount, 0);
        const refunds = lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
        expect({ gross, refunds, net: gross - refunds, purchases: lines.filter((l) => l.amount < 0).length }, `${scope}/${g.key}`)
          .toEqual({ gross: g.gross, refunds: g.refunds, net: g.net, purchases: g.purchases });
      }
    }
  });

  it('categoryLines: a body without its commission, the commission as its own «комиссии банка» line; newest first', async () => {
    const p2p = (await categoryLines(db, { ...Q, category: 'переводы людям' }, NOW)).lines;
    expect(p2p.map((l) => [l.kind, l.amount, l.operationAmount])).toEqual([['body', -20_000, -20_400]]);
    const fees = (await categoryLines(db, { ...Q, category: 'комиссии банка' }, NOW)).lines;
    expect(fees.map((l) => [l.kind, l.amount, l.operationCurrency])).toEqual([['commission', -2_000, null], ['commission', -400, null]]);
    expect(fees[0]!.time).toBeGreaterThan(fees[1]!.time);
    const cafe = (await categoryLines(db, { ...Q, category: 'кафе и рестораны' }, NOW)).lines;
    expect(cafe.map((l) => l.amount)).toEqual([1_000, -4_000]); // the refund is a positive line
    expect((await categoryLines(db, { ...Q, category: 'свои переводы' }, NOW)).lines).toEqual([]);
  });

  it('day (internal, not an MCP choice): one group per Kyiv day, the same totals', async () => {
    const s = await spendingSummary(db, { ...Q, groupBy: 'day' }, NOW);
    expect(s.groups.filter((g) => g.currency === 980).map((g) => [g.key, g.net, g.purchases])).toEqual([
      ['2026-02-03', 20_400, 2], // body + its commission line
      ['2026-01-05', 10_000, 1],
      ['2026-02-06', 7_000, 1],
      ['2026-01-20', 4_000, 1],
      ['2026-02-04', 2_000, 1], // an own transfer: only its commission is spending
      ['2026-01-21', -1_000, 0], // a refund only
    ]);
    expect(s.totals).toEqual((await spendingSummary(db, Q, NOW)).totals);
    expect(SPENDING_GROUP_BY).not.toContain('day');
  });

  it('month / account / mcc / scope keys; account groups carry a label, never a card number', async () => {
    const keys = async (groupBy: (typeof SPENDING_GROUP_BY)[number]) =>
      (await spendingSummary(db, { ...Q, groupBy }, NOW)).groups.filter((g) => g.currency === 980).map((g) => [g.key, g.net]);
    expect(await keys('month')).toEqual([['2026-02', 29_400], ['2026-01', 13_000]]);
    expect(await keys('scope')).toEqual([['personal', 35_400], ['business', 7_000]]);
    expect(await keys('mcc')).toEqual([['4829', 27_000], ['5411', 10_000], ['5812', 3_000], ['commission', 2_400]]);
    const acc = await spendingSummary(db, { ...Q, groupBy: 'account' }, NOW);
    expect(acc.groups.map((g) => [g.key, g.label])).toEqual([['usd', 'black/USD'], ['black', 'black/UAH'], ['fop', 'fop/UAH']]);
    expect(JSON.stringify(acc)).not.toMatch(/CANARY|7777/);
  });

  it('filters: scope, account, category (incl. commissions); an unknown groupBy / scope is an error', async () => {
    expect((await spendingSummary(db, { ...Q, scope: 'business' }, NOW)).totals).toEqual([
      { currency: 980, lines: 1, purchases: 1, gross: 7_000, refunds: 0, net: 7_000, netPerDay: 119, operation: { currency: 980, gross: 7_000, refunds: 0, net: 7_000 } },
    ]);
    expect((await spendingSummary(db, { ...Q, accountId: 'usd' }, NOW)).groups.map((g) => g.key)).toEqual(['путешествия']);
    expect((await spendingSummary(db, { ...Q, category: 'комиссии банка' }, NOW)).totals[0]?.net).toBe(2_400);
    await expect(spendingSummary(db, { ...Q, groupBy: 'merchant' as never }, NOW)).rejects.toThrow(SummaryError);
    await expect(spendingSummary(db, { ...Q, scope: 'family' as never }, NOW)).rejects.toThrow(SummaryError);
  });

  it('spendingByCategory is the same numbers', async () => {
    const s = await spendingSummary(db, Q, NOW);
    expect(await spendingByCategory(db, Q.from, Q.to)).toEqual(
      s.groups.map((g) => ({ currency: g.currency, category: g.key, lines: g.lines, gross: g.gross, refunds: g.refunds, net: g.net })),
    );
  });
});

describe('comparePeriods', () => {
  it('per group: diff = b − a, % of a, new / gone; totals per covered day; incomplete B is flagged', async () => {
    await tx('black', '2026-01-10', -10_000, { category: 'продукты' });
    await tx('black', '2026-01-11', -3_000, { category: 'такси и транспорт', mcc: 4121 });
    await tx('black', '2026-03-02', -15_000, { category: 'продукты' });
    await tx('black', '2026-03-03', -2_000, { category: 'кафе и рестораны', mcc: 5812 });
    const c = await comparePeriods(db, { a: { from: '2026-01-01', to: '2026-01-31' }, b: { from: '2026-03-01', to: '2026-03-31' } }, NOW);
    expect(c.a.incomplete).toBe(false);
    expect(c.b).toMatchObject({ incomplete: true, coveredDays: 9 });
    expect(c.rows).toEqual([
      { currency: 980, key: 'продукты', a: 10_000, b: 15_000, diff: 5_000, diffPct: 50, status: 'both' },
      { currency: 980, key: 'такси и транспорт', a: 3_000, b: 0, diff: -3_000, diffPct: -100, status: 'gone' },
      { currency: 980, key: 'кафе и рестораны', a: 0, b: 2_000, diff: 2_000, diffPct: null, status: 'new' },
    ]);
    expect(c.totals).toEqual([{ currency: 980, a: 13_000, b: 17_000, diff: 4_000, diffPct: 30.8, aPerDay: 419, bPerDay: 1_889 }]);
  });
});

describe('incomeSummary', () => {
  it('«поступления» only, not internal, not refunds; source by shape, never by name', async () => {
    await tx('black', '2026-02-01', 10_000, { category: 'поступления', mcc: 6012 });
    await tx('black', '2026-02-02', 2_000, { category: 'поступления', mcc: 4829, description: 'Від: Вигадана Особа' });
    await tx('black', '2026-02-03', 3_000, { category: 'поступления', mcc: 4829, description: 'Вигаданий Опис' });
    await tx('usd', '2026-02-04', 5_000, { category: 'поступления', mcc: 4829, scope: 'business' });
    // marked internal but still «поступления» (the categories pass failed after the transfer pass) → not income
    await tx('black', '2026-02-05', 50_000, { category: 'поступления', mcc: 4829, internal: true });
    await tx('black', '2026-02-06', 700, { category: 'кафе и рестораны', mcc: 4829 }); // a refund
    const s = await incomeSummary(db, { from: '2026-02-01', to: '2026-02-28' }, NOW);
    expect(s.groups.map(({ currency, key, lines, total }) => ({ currency, key, lines, total }))).toEqual([
      { currency: 840, key: 'transfer', lines: 1, total: 5_000 },
      { currency: 980, key: 'other_bank', lines: 1, total: 10_000 },
      { currency: 980, key: 'transfer', lines: 1, total: 3_000 },
      { currency: 980, key: 'named_sender', lines: 1, total: 2_000 },
    ]);
    expect(s.totals).toEqual([
      { currency: 840, lines: 1, total: 5_000, totalPerDay: 179 },
      { currency: 980, lines: 3, total: 15_000, totalPerDay: 536 },
    ]);
    expect(JSON.stringify(s)).not.toContain('Вигадан');
    expect((await incomeSummary(db, { from: '2026-02-01', to: '2026-02-28', scope: 'business' }, NOW)).totals).toHaveLength(1);
    expect((await incomeSummary(db, { from: '2026-02-01', to: '2026-02-28', groupBy: 'account' }, NOW)).groups.map((g) => g.label)).toEqual([
      'black/USD', 'black/UAH',
    ]);
    expect(incomeSource(5411, '', 'monobank')).toBe('other');
  });

  it('incomeLines: the rows behind incomeSummary, newest first, with source and sender; same filters', async () => {
    await tx('black', '2026-02-01', 10_000, { category: 'поступления', mcc: 6012, description: 'Вигаданий Банк' });
    await tx('black', '2026-02-02', 2_000, { category: 'поступления', mcc: 4829, description: 'Від: Вигадана Особа' });
    await tx('usd', '2026-02-04', 5_000, { category: 'поступления', mcc: 4829, scope: 'business', opCurrency: 978, opAmount: 4_600 });
    await tx('black', '2026-02-05', 50_000, { category: 'поступления', mcc: 4829, internal: true });
    await tx('black', '2026-02-06', 700, { category: 'кафе и рестораны', mcc: 4829 });
    await tx('black', '2026-02-07', 900, { category: 'поступления', mcc: 4829, cancelled: true });
    for (const scope of [undefined, 'personal', 'business'] as const) {
      const q = { from: '2026-02-01', to: '2026-02-28', ...(scope ? { scope } : {}) };
      const lines = (await incomeLines(db, q, NOW)).lines;
      const sums = new Map<number, { lines: number; total: number }>();
      for (const l of lines) {
        const t = sums.get(l.currency) ?? { lines: 0, total: 0 };
        sums.set(l.currency, { lines: t.lines + 1, total: t.total + l.amount });
      }
      expect([...sums].map(([currency, t]) => ({ currency, ...t })).sort((a, b) => a.currency - b.currency), String(scope))
        .toEqual((await incomeSummary(db, q, NOW)).totals.map(({ currency, lines, total }) => ({ currency, lines, total })));
    }
    const all = (await incomeLines(db, { from: '2026-02-01', to: '2026-02-28' }, NOW)).lines;
    expect(all.map((l) => [l.amount, l.source, l.sender, l.operationCurrency, l.operationAmount])).toEqual([
      [5_000, 'transfer', null, 978, 4_600],
      [2_000, 'named_sender', 'Вигадана Особа', 980, 2_000],
      [10_000, 'other_bank', null, 980, 10_000],
    ]);
  });
});

describe('getBalances', () => {
  it('own_funds = balance − credit limit (main number), available = balance; jars by the sync rule; no card numbers or titles', async () => {
    const b = await getBalances(db);
    expect(b.accounts.map(({ id, label, kind, currency, own_funds, credit_limit, available }) => ({ id, label, kind, currency, own_funds, credit_limit, available }))).toEqual([
      { id: 'usd', label: 'black/USD', kind: 'card', currency: 840, own_funds: 1_000, credit_limit: 0, available: 1_000 },
      { id: 'black', label: 'black/UAH', kind: 'card', currency: 980, own_funds: -1_000_000, credit_limit: 20_000_000, available: 19_000_000 },
      { id: 'fop', label: 'fop/UAH', kind: 'card', currency: 980, own_funds: 50_000, credit_limit: 0, available: 50_000 },
      // labels are unique over ALL accounts (stable across tools), so the hidden empty jar still adds the id suffix
      { id: 'jar', label: 'банка/UAH #jar', kind: 'jar', currency: 980, own_funds: 30_000, credit_limit: 0, available: 30_000 },
    ]);
    expect(b.totals).toEqual([
      { currency: 840, own_funds: 1_000 },
      { currency: 980, own_funds: -920_000 },
    ]);
    expect(JSON.stringify(b)).not.toMatch(/CANARY|Canary|7777/);
  });
});

describe('getSyncStatus', () => {
  it('covered ranges per account, data_until, next request time, diagnostics; not-imported accounts flagged', async () => {
    await db.execute({ sql: 'DELETE FROM sync_state WHERE account_id = ?', args: ['usd'] });
    await db.execute({ sql: 'UPDATE sync_state SET newest_synced_time = ?, last_sync_at = ? WHERE account_id = ?', args: [kyivStartOfDay('2026-03-08'), kyivStartOfDay('2026-03-08'), 'jar'] });
    await db.execute({ sql: 'INSERT INTO api_calls (endpoint, called_at) VALUES (?, ?)', args: ['/personal/statement', NOW * 1000 - 20_000] });
    await tx('black', '2026-03-01', -100, { hold: true }); // older than 3 days: not pending
    await tx('black', '2026-03-13', -100, { hold: true });
    const s = await getSyncStatus(db, NOW * 1000);
    expect(s.accounts).toEqual([
      { id: 'usd', label: 'black/USD', imported: false, covered_from: null, covered_to: null, last_sync_at: null, hours_since_sync: null },
      { id: 'black', label: 'black/UAH', imported: true, covered_from: '2026-01-01', covered_to: '2026-03-10', last_sync_at: '2026-03-10 23:00', hours_since_sync: 109 },
      { id: 'fop', label: 'fop/UAH', imported: true, covered_from: '2026-01-01', covered_to: '2026-03-10', last_sync_at: '2026-03-10 23:00', hours_since_sync: 109 },
      { id: 'jar', label: 'банка/UAH #jar', imported: true, covered_from: '2026-01-01', covered_to: '2026-03-08', last_sync_at: '2026-03-08 00:00', hours_since_sync: 180 },
    ]);
    expect(s.data_until).toBe('2026-03-08');
    expect(s.last_sync_at).toBe('2026-03-10 23:00');
    expect(s.next_request_at).toBe('2026-03-15 12:00');
    expect(s.diagnostics).toMatchObject({ pending_holds: 1, refund_pairs: 0, unpaired_service_4829: 0, scope: { personal: 2, business: 0 } });
    expect(JSON.stringify(s)).not.toMatch(/CANARY|Canary|7777/);

    await db.execute('DELETE FROM api_calls');
    expect((await getSyncStatus(db, NOW * 1000)).next_request_at).toBeNull();
  });
});

describe('spendingGrid (category × day / month, the analytics screen)', () => {
  beforeEach(async () => {
    await tx('black', '2026-02-03', -20_000);
    await tx('black', '2026-02-20', -5_000, { category: 'кафе и рестораны' });
    await tx('black', '2026-03-02', -30_000);
    await tx('black', '2026-03-05', -8_000, { category: 'кафе и рестораны' });
    await tx('black', '2026-03-05', 2_000, { category: 'кафе и рестораны' }); // a refund
    await tx('black', '2026-03-06', -1_000, { commission: 100 }); // body 900 + a «комиссии банка» line of 100
    await tx('usd', '2026-03-06', -100);
    await tx('black', '2026-03-08', -5_000, { category: 'свои переводы', internal: true });
  });

  it('months: one cell per currency × month × category; refunds net out; commission is its own category', async () => {
    const g = await spendingGrid(db, { from: '2026-02-01', to: '2026-03-31', unit: 'month' }, NOW);
    expect(g.unit).toBe('month');
    expect(g.cells.map((c) => [c.currency, c.bucket, c.category, c.net])).toEqual([
      [840, '2026-03', 'продукты', 100],
      [980, '2026-02', 'кафе и рестораны', 5_000],
      [980, '2026-02', 'продукты', 20_000],
      [980, '2026-03', 'кафе и рестораны', 6_000],
      [980, '2026-03', 'комиссии банка', 100],
      [980, '2026-03', 'продукты', 30_900],
    ]);
    expect(g.cells.find((c) => c.bucket === '2026-03' && c.category === 'кафе и рестораны')).toMatchObject({ gross: 8_000, refunds: 2_000, purchases: 1 });
  });

  it("days: keys are the zone's dates; per currency the cells add up to spendingSummary by category", async () => {
    const g = await spendingGrid(db, { from: '2026-03-01', to: '2026-03-31', unit: 'day' }, NOW);
    expect([...new Set(g.cells.map((c) => c.bucket))].sort()).toEqual(['2026-03-02', '2026-03-05', '2026-03-06']);
    const s = await spendingSummary(db, { from: '2026-03-01', to: '2026-03-31', groupBy: 'category' }, NOW);
    for (const t of s.totals) {
      expect(g.cells.filter((c) => c.currency === t.currency).reduce((n, c) => n + c.net, 0)).toBe(t.net);
    }
  });

  it('refuses an unknown unit', async () => {
    await expect(spendingGrid(db, { from: '2026-03-01', to: '2026-03-31', unit: 'week' as 'day' }, NOW)).rejects.toThrow(SummaryError);
  });
});

describe('incomeSummary groupBy day (desktop only)', () => {
  it('one group per currency and local date', async () => {
    await tx('black', '2026-03-02', 40_000, { category: 'поступления', mcc: 4829 });
    await tx('black', '2026-03-02', 10_000, { category: 'поступления', mcc: 4829 });
    await tx('black', '2026-03-04', 5_000, { category: 'поступления', mcc: 4829 });
    const s = await incomeSummary(db, { from: '2026-03-01', to: '2026-03-31', groupBy: 'day' }, NOW);
    expect(s.groups.map((g) => [g.key, g.total, g.lines])).toEqual([['2026-03-02', 50_000, 2], ['2026-03-04', 5_000, 1]]);
  });

  it('is not offered to the MCP tools', () => {
    expect(INCOME_GROUP_BY).not.toContain('day');
  });
});
