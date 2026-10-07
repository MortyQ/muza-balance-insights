import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { kyivStartOfDay } from '../src/format.ts';
import { amountGroups, findRecurring, payeeKey, RecurringError, setRecurringMark, trailingSeries } from '../src/recurring.ts';
import { insertAccountRow, memoryDb } from './helpers.ts';

// "Now" = 2026-03-15 12:00 Kyiv. Fictional payees and amounts only.
const NOW = kyivStartOfDay('2026-03-15') + 12 * 3600;
const PERIOD = { from: '2025-02-01', to: '2026-03-15' };
const DAY = 86_400;

let db: Db;
let seq = 0;

async function account(id: string, currency = 980) {
  await insertAccountRow(db, { id, kind: 'card', type: 'black', currency_code: currency, balance: 0, updated_at: NOW });
  await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: [id, kyivStartOfDay('2025-01-01'), NOW, NOW] });
}

async function tx(
  accountId: string,
  date: string,
  amount: number,
  o: { description?: string; category?: string; mcc?: number; iban?: string; opCurrency?: number; opAmount?: number; internal?: boolean } = {},
) {
  const id = `t${++seq}`;
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount, currency_code,
            commission_rate, category, is_internal_transfer, scope, is_cancelled, raw_json, synced_at, counter_iban)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, COALESCE(?, (SELECT currency_code FROM accounts WHERE id = ?)), 0, ?, ?, 'personal', 0, '{}', 0, ?)`,
    args: [
      id, accountId, kyivStartOfDay(date) + 3600, date, o.description ?? 'Streamio', o.mcc ?? 5815, amount, o.opAmount ?? amount, o.opCurrency ?? null,
      accountId, o.category ?? 'связь и цифровые сервисы', o.internal ? 1 : 0, o.iban ?? null,
    ],
  });
  return id;
}

/** `n` payments on the `day`th of consecutive months, the last in `lastMonth` (YYYY-MM). */
async function monthly(accountId: string, lastMonth: string, n: number, amount: number, o: Parameters<typeof tx>[3] = {}, day = 5) {
  const [y, m] = lastMonth.split('-').map(Number) as [number, number];
  const ids: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, day));
    ids.push(await tx(accountId, d.toISOString().slice(0, 10), amount, o));
  }
  return ids;
}

beforeEach(async () => {
  seq = 0;
  db = await memoryDb();
  await account('uah');
});
afterEach(() => db.close());

describe('payeeKey', () => {
  it('the account paid to wins; else the description without case, punctuation and long numbers', () => {
    expect(payeeKey('Rent', 'UA00FICTIONAL', null)).toBe('iban:UA00FICTIONAL');
    expect(payeeKey('Rent', null, '12345678')).toBe('edrpou:12345678');
    expect(payeeKey('STREAMIO*Order 48213', null, null)).toBe(payeeKey('streamio order 99107', null, null));
    expect(payeeKey('Streamio', null, null)).not.toBe(payeeKey('Gamebox', null, null));
  });
});

describe('amountGroups / trailingSeries', () => {
  it('payments of one payee split by amount within ±10%', () => {
    const g = amountGroups([{ opAmount: 9_900 }, { opAmount: 16_900 }, { opAmount: 10_200 }, { opAmount: 17_100 }]);
    expect(g.map((xs) => xs.map((x) => x.opAmount))).toEqual([[9_900, 10_200], [16_900, 17_100]]);
  });

  it('the series back from the newest payment: monthly gaps and one skipped month keep it; a longer gap ends it', () => {
    const at = (d: number) => ({ time: d * DAY });
    expect(trailingSeries([at(0), at(30), at(60)])).toEqual([at(0), at(30), at(60)]);
    expect(trailingSeries([at(0), at(30), at(91), at(121)])).toEqual([at(0), at(30), at(91), at(121)]);
    expect(trailingSeries([at(0), at(200), at(230), at(260)])).toEqual([at(200), at(230), at(260)]);
    expect(trailingSeries([at(0), at(30)])).toBeNull();
    // Three payments but only one month gap.
    expect(trailingSeries([at(0), at(60), at(90)])).toBeNull();
    // Weekly: no month gap at all.
    expect(trailingSeries([at(0), at(7), at(14), at(21)])).toBeNull();
  });
});

describe('findRecurring', () => {
  it('a monthly subscription: usual amount, payments, first and last, active', async () => {
    const ids = await monthly('uah', '2026-03', 4, -19_900);
    const [p] = await findRecurring(db, PERIOD, NOW);
    expect(p).toMatchObject({
      id: ids[3], description: 'Streamio', category: 'связь и цифровые сервисы', mcc: 5815, accountId: 'uah', currency: 980,
      amount: 19_900, operationCurrency: 980, operationAmount: 19_900, payments: 4, active: true,
    });
    expect(p!.first).toBe(kyivStartOfDay('2025-12-05') + 3600);
    expect(p!.last).toBe(kyivStartOfDay('2026-03-05') + 3600);
  });

  it('an amount that drifts within ±10% stays one series; the usual amount is the median', async () => {
    await tx('uah', '2025-12-10', -40_000, { description: 'Power Co', category: 'коммунальные', mcc: 4900 });
    await tx('uah', '2026-01-10', -43_000, { description: 'Power Co', category: 'коммунальные', mcc: 4900 });
    await tx('uah', '2026-02-10', -41_000, { description: 'Power Co', category: 'коммунальные', mcc: 4900 });
    const found = await findRecurring(db, PERIOD, NOW);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ amount: 41_000, payments: 3, category: 'коммунальные' });
  });

  it('coffee at one price bought whenever is not regular', async () => {
    for (const d of ['2026-01-03', '2026-01-04', '2026-01-19', '2026-02-02', '2026-02-27', '2026-03-01', '2026-03-09']) {
      await tx('uah', d, -6_500, { description: 'Bean Bar', category: 'кафе и рестораны', mcc: 5814 });
    }
    expect(await findRecurring(db, PERIOD, NOW)).toEqual([]);
  });

  it('two payees with one MCC are two series; two prices at one payee are two series', async () => {
    await monthly('uah', '2026-03', 3, -9_900, { description: 'Cloudbox' });
    await monthly('uah', '2026-03', 3, -9_900, { description: 'Tunely' }, 8);
    await monthly('uah', '2026-03', 3, -29_900, { description: 'Cloudbox' }, 12);
    const found = await findRecurring(db, PERIOD, NOW);
    expect(found.map((p) => [p.description, p.amount])).toEqual([['Cloudbox', 29_900], ['Cloudbox', 9_900], ['Tunely', 9_900]]);
  });

  it('a dollar subscription paid from a hryvnia card is matched by the dollar amount, whatever the hryvnia was', async () => {
    const o = { description: 'Codehub', opCurrency: 840 };
    await tx('uah', '2025-12-02', -40_000, { ...o, opAmount: -1_000 });
    await tx('uah', '2026-01-02', -42_500, { ...o, opAmount: -1_000 });
    await tx('uah', '2026-02-02', -44_000, { ...o, opAmount: -1_000 });
    const [p] = await findRecurring(db, PERIOD, NOW);
    expect(p).toMatchObject({ currency: 980, amount: 42_500, operationCurrency: 840, operationAmount: 1_000, payments: 3 });
  });

  it('rent paid to one account under changing descriptions is one series', async () => {
    const o = { category: 'переводы людям', mcc: 4829, iban: 'UA00FICTIONALRENT' };
    await tx('uah', '2025-12-01', -1_200_000, { ...o, description: 'Rent December' });
    await tx('uah', '2026-01-01', -1_200_000, { ...o, description: 'For the flat' });
    await tx('uah', '2026-02-01', -1_200_000, { ...o, description: 'Rent' });
    const [p] = await findRecurring(db, PERIOD, NOW);
    expect(p).toMatchObject({ description: 'Rent', payments: 3, amount: 1_200_000 });
  });

  it('a series whose last payment is over 40 days old has ended: listed after the active ones', async () => {
    await monthly('uah', '2025-11', 5, -50_000, { description: 'Old Gym', category: 'спорт', mcc: 7997 });
    await monthly('uah', '2026-03', 3, -9_900);
    const found = await findRecurring(db, PERIOD, NOW);
    expect(found.map((p) => [p.description, p.active])).toEqual([['Streamio', true], ['Old Gym', false]]);
  });

  it('own transfers, refunds and other people\'s accounts are not regular payments; a person sees their own only', async () => {
    await monthly('uah', '2026-03', 3, -100_000, { description: 'To the jar', category: 'свои переводы', internal: true });
    await monthly('uah', '2026-03', 3, 5_000, { description: 'Cashback Co' });
    expect(await findRecurring(db, PERIOD, NOW)).toEqual([]);

    const her = Number((await db.execute(`INSERT INTO participants (label, created_at) VALUES ('Вигадана', 0) RETURNING id`)).rows[0]?.id);
    const conn = Number((await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id);
    await insertAccountRow(db, { id: 'hers', connection_id: conn, kind: 'card', type: 'white', currency_code: 980, balance: 0, updated_at: NOW });
    await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: ['hers', kyivStartOfDay('2025-01-01'), NOW, NOW] });
    await monthly('hers', '2026-03', 3, -9_900);

    expect((await findRecurring(db, PERIOD, NOW)).map((p) => p.participantId)).toEqual([her]);
    const me = Number((await db.execute({ sql: 'SELECT id FROM participants WHERE id <> ? ORDER BY id LIMIT 1', args: [her] })).rows[0]?.id);
    expect(await findRecurring(db, { ...PERIOD, participantId: me }, NOW)).toEqual([]);
  });

  it('payments before the period are not seen', async () => {
    // December 2024 … February 2025: only February is in the period.
    await monthly('uah', '2025-02', 3, -9_900);
    expect(await findRecurring(db, PERIOD, NOW)).toEqual([]);
  });

  it('a found series has no mark', async () => {
    await monthly('uah', '2026-03', 3, -9_900);
    expect((await findRecurring(db, PERIOD, NOW))[0]!.mark).toBeNull();
  });
});

describe('setRecurringMark', () => {
  it('marks the payee: the mark holds for a later payment, can change and be cleared', async () => {
    const ids = await monthly('uah', '2026-02', 3, -9_900);
    await setRecurringMark(db, ids[0]!, 'mandatory', NOW);
    expect((await findRecurring(db, PERIOD, NOW))[0]!.mark).toBe('mandatory');

    // A new month's payment: a new last id, the same payee.
    const next = await tx('uah', '2026-03-05', -9_900);
    const [p] = await findRecurring(db, PERIOD, NOW);
    expect(p).toMatchObject({ id: next, mark: 'mandatory' });

    await setRecurringMark(db, next, 'hidden', NOW);
    expect((await findRecurring(db, PERIOD, NOW))[0]!.mark).toBe('hidden');
    await setRecurringMark(db, next, null, NOW);
    expect((await findRecurring(db, PERIOD, NOW))[0]!.mark).toBeNull();
    expect((await db.execute('SELECT COUNT(*) AS n FROM recurring_marks')).rows[0]?.n).toBe(0);
  });

  it('by the account paid to: a new description keeps the mark; another payee is not marked', async () => {
    const o = { category: 'переводы людям', mcc: 4829, iban: 'UA00FICTIONALRENT' };
    const first = await tx('uah', '2026-01-01', -1_200_000, { ...o, description: 'Rent January' });
    await tx('uah', '2026-02-01', -1_200_000, { ...o, description: 'For the flat' });
    await tx('uah', '2026-03-01', -1_200_000, { ...o, description: 'Rent' });
    await monthly('uah', '2026-03', 3, -9_900);
    await setRecurringMark(db, first, 'mandatory', NOW);
    const found = await findRecurring(db, PERIOD, NOW);
    expect(found.map((p) => [p.description, p.mark])).toEqual([['Rent', 'mandatory'], ['Streamio', null]]);
  });

  it('the same payee in another operation currency is another mark', async () => {
    const uahIds = await monthly('uah', '2026-03', 3, -9_900, { description: 'Codehub' });
    await monthly('uah', '2026-03', 3, -40_000, { description: 'Codehub', opCurrency: 840, opAmount: -1_000 }, 9);
    await setRecurringMark(db, uahIds[2]!, 'hidden', NOW);
    const found = await findRecurring(db, PERIOD, NOW);
    expect(found.map((p) => [p.operationCurrency, p.mark])).toEqual([[840, null], [980, 'hidden']]);
  });

  it('an unknown transaction or mark is refused', async () => {
    await expect(setRecurringMark(db, 'nope', 'mandatory', NOW)).rejects.toThrow(RecurringError);
    const [id] = await monthly('uah', '2026-03', 3, -9_900);
    await expect(setRecurringMark(db, id!, 'optional' as never, NOW)).rejects.toThrow(RecurringError);
  });
});

describe('findRecurring: regular income', () => {
  const IN = { category: 'поступления', mcc: 4829 };

  it('a sender who pays about once a month, in dollars with a drifting amount; the newest on its own day', async () => {
    await account('fop', 840);
    await tx('fop', '2025-12-07', 220_000, { ...IN, description: 'Від: Client Fictional' });
    await tx('fop', '2026-01-04', 224_000, { ...IN, description: 'Від: Client Fictional' });
    await tx('fop', '2026-02-06', 218_000, { ...IN, description: 'Від: Client Fictional' });
    await tx('fop', '2026-03-05', 221_000, { ...IN, description: 'Від: Client Fictional' });
    const [p] = await findRecurring(db, { ...PERIOD, kind: 'income' }, NOW);
    expect(p).toMatchObject({ description: 'Від: Client Fictional', category: 'поступления', currency: 840, amount: 220_500, payments: 4, active: true });
    expect(p!.last).toBe(kyivStartOfDay('2026-03-05') + 3600);
  });

  it('income is not spending and spending is not income; a refund is no income; irregular credits are no series', async () => {
    await monthly('uah', '2026-03', 3, -9_900);
    await monthly('uah', '2026-03', 3, 50_000, { ...IN, description: 'Від: Salary Co' }, 2);
    // A refund: a credit outside «поступления».
    await monthly('uah', '2026-03', 3, 9_900, { description: 'Streamio' }, 7);
    for (const d of ['2026-01-03', '2026-01-09', '2026-02-20', '2026-03-01']) await tx('uah', d, 30_000, { ...IN, description: 'Від: Friend' });
    expect((await findRecurring(db, { ...PERIOD, kind: 'income' }, NOW)).map((p) => p.description)).toEqual(['Від: Salary Co']);
    expect((await findRecurring(db, PERIOD, NOW)).map((p) => p.description)).toEqual(['Streamio']);
  });
});
