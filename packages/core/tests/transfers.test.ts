import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { createMonoClient } from '../src/monoApi.ts';
import { transferDiagnostics } from '../src/queries.ts';
import { syncWindow, type SyncContext } from '../src/sync.ts';
import {
  TRANSFER_WINDOW_SEC,
  detectTransfers,
  markInternalTransfers,
  type TransferAccount,
  type TransferMark,
  type TransferTx,
} from '../src/transfers.ts';
import { TEST_TOKEN, fakeClock, fakeMonobank, insertAccount, item, memoryDb } from './helpers.ts';

const JAR_TITLE = 'На мрію';
const ACCOUNTS: TransferAccount[] = [
  { id: 'black', kind: 'card', currencyCode: 980, iban: 'UA111', title: null },
  { id: 'white', kind: 'card', currencyCode: 980, iban: 'UA222', title: null },
  { id: 'usd', kind: 'card', currencyCode: 840, iban: 'UA333', title: null },
  { id: 'fop980', kind: 'card', currencyCode: 980, iban: 'UA444', title: null },
  { id: 'fop840', kind: 'card', currencyCode: 840, iban: 'UA555', title: null },
  { id: 'jar', kind: 'jar', currencyCode: 980, iban: null, title: JAR_TITLE },
];

function tx(id: string, accountId: string, time: number, amount: number, extra: Partial<TransferTx> = {}): TransferTx {
  return {
    id, accountId, time, amount,
    operationAmount: amount,
    commissionRate: 0,
    mcc: 4829,
    description: '',
    counterIban: null,
    ...extra,
  };
}

function marksOf(rows: TransferTx[]): Record<string, TransferMark | undefined> {
  const m = detectTransfers(rows, ACCOUNTS);
  return Object.fromEntries(rows.map((r) => [r.id, m.get(r.id)]));
}

describe('detectTransfers: pair', () => {
  it('pairs the card-side jar debit with the jar top-up, not the purchase that triggered it', () => {
    const m = marksOf([
      tx('buy', 'black', 1000, -63_660, { mcc: 5411, description: 'Сільпо' }),
      tx('debit', 'black', 1000, -6_366, { description: JAR_TITLE }),
      tx('topup', 'jar', 1001, 6_366, { description: '10%' }),
    ]);
    expect(m.buy).toBeUndefined();
    expect(m.debit).toEqual({ rule: 'pair', pairId: 'topup' });
    expect(m.topup).toEqual({ rule: 'pair', pairId: 'debit' });
  });

  it('two purchases in one second with identical 10% top-ups: strictly one-to-one, ties by id', () => {
    const m = marksOf([
      tx('c2', 'black', 500, -500, { description: JAR_TITLE }),
      tx('j2', 'jar', 500, 500, { description: '10%' }),
      tx('c1', 'black', 500, -500, { description: JAR_TITLE }),
      tx('j1', 'jar', 500, 500, { description: '10%' }),
    ]);
    expect(m.c1).toEqual({ rule: 'pair', pairId: 'j1' });
    expect(m.j1).toEqual({ rule: 'pair', pairId: 'c1' });
    expect(m.c2).toEqual({ rule: 'pair', pairId: 'j2' });
    expect(m.j2).toEqual({ rule: 'pair', pairId: 'c2' });
  });

  it('picks the smallest Δt when several mirrors qualify', () => {
    const m = marksOf([
      tx('far', 'black', 990, -200, { description: JAR_TITLE }),
      tx('near', 'black', 999, -200, { description: JAR_TITLE }),
      tx('topup', 'jar', 1000, 200, { description: '10%' }),
    ]);
    expect(m.topup).toEqual({ rule: 'pair', pairId: 'near' });
    expect(m.far?.rule).toBe('text'); // no partner left; its description is an own-transfer template
  });

  it(`requires MCC 4829 on both sides and |Δt| ≤ ${TRANSFER_WINDOW_SEC} s`, () => {
    const inWindow = marksOf([tx('a', 'white', 0, -100), tx('b', 'black', TRANSFER_WINDOW_SEC, 100)]);
    expect(inWindow.a?.rule).toBe('pair');
    const tooFar = marksOf([tx('a', 'white', 0, -100), tx('b', 'black', TRANSFER_WINDOW_SEC + 1, 100)]);
    expect(tooFar.a).toBeUndefined();
    const refund = marksOf([tx('a', 'white', 0, -100, { mcc: 5411 }), tx('b', 'black', 1, 100)]);
    expect(refund.a).toBeUndefined();
  });
});

describe('detectTransfers: pair_fx', () => {
  it('pairs UAH → USD when each operation_amount mirrors the other amount', () => {
    const m = marksOf([
      tx('out', 'white', 100, -5_000_000, { operationAmount: -111_035 }),
      tx('in', 'usd', 100, 111_035, { operationAmount: 5_000_000 }),
    ]);
    expect(m.out).toEqual({ rule: 'pair_fx', pairId: 'in' });
    expect(m.in).toEqual({ rule: 'pair_fx', pairId: 'out' });
  });

  it('USD FOP → UAH FOP → white chain: the one-sided match to white is rejected', () => {
    const m = marksOf([
      tx('usdOut', 'fop840', 100, -321_000, { operationAmount: -14_326_230 }),
      tx('uahIn', 'fop980', 101, 14_326_230, { operationAmount: 321_000 }),
      tx('uahOut', 'fop980', 101, -14_326_230, { operationAmount: -14_326_230 }),
      tx('whiteIn', 'white', 101, 14_326_230, { operationAmount: 14_326_230 }),
    ]);
    expect(m.usdOut).toEqual({ rule: 'pair_fx', pairId: 'uahIn' });
    expect(m.uahOut).toEqual({ rule: 'pair', pairId: 'whiteIn' });
  });

  it('needs both equalities', () => {
    const m = marksOf([
      tx('out', 'white', 100, -5_000_000, { operationAmount: -111_035 }),
      tx('in', 'usd', 100, 111_035, { operationAmount: 4_999_999 }),
    ]);
    expect(m.out).toBeUndefined();
  });
});

describe('detectTransfers: jar_reversal', () => {
  it('pairs an auto top-up with its rollback inside the same jar', () => {
    const m = marksOf([
      tx('tax', 'black', 97, -578_121, { mcc: 9311 }),
      tx('plus', 'jar', 100, 57_812, { description: '10%' }),
      tx('minus', 'jar', 102, -57_812, { description: '10%' }),
    ]);
    expect(m.plus).toEqual({ rule: 'jar_reversal', pairId: 'minus' });
    expect(m.minus).toEqual({ rule: 'jar_reversal', pairId: 'plus' });
    expect(m.tax).toBeUndefined();
  });

  it('not when the negative row comes first, or the description is not an auto top-up', () => {
    const reversedOrder = marksOf([
      tx('minus', 'jar', 100, -57_812, { description: '10%' }),
      tx('plus', 'jar', 102, 57_812, { description: '10%' }),
    ]);
    expect(reversedOrder.minus?.rule).not.toBe('jar_reversal');
    const manual = marksOf([
      tx('plus', 'jar', 100, 10_000, { description: 'З Чорної картки' }),
      tx('minus', 'jar', 102, -10_000, { description: 'На чорну картку' }),
    ]);
    expect(manual.plus?.rule).not.toBe('jar_reversal');
  });
});

describe('detectTransfers: iban and text fallback', () => {
  it('marks a row whose counter_iban is an own account (normalized)', () => {
    const m = marksOf([tx('a', 'black', 0, -100, { mcc: 4829, counterIban: 'ua 222' })]);
    expect(m.a).toEqual({ rule: 'iban', pairId: null });
  });

  it('text: own-transfer templates without a pair; never «Переказ на картку» or «Щомісячний платіж»', () => {
    const m = marksOf([
      tx('tmpl', 'black', 0, -100, { description: `Округлення балансу «${JAR_TITLE}»` }),
      tx('own', 'white', 1000, 500, { description: 'З Білої картки' }),
      tx('generic', 'white', 2000, -700, { description: 'Переказ на картку' }),
      tx('installment', 'black', 3000, -45_804, { description: 'Щомісячний платіж ' }),
      tx('wrongMcc', 'black', 4000, -100, { description: 'З Білої картки', mcc: 5411 }),
    ]);
    expect(m.tmpl).toEqual({ rule: 'text', pairId: null });
    expect(m.own).toEqual({ rule: 'text', pairId: null });
    expect(m.generic).toBeUndefined();
    expect(m.installment).toBeUndefined();
    expect(m.wrongMcc).toBeUndefined();
  });
});

// ---------- DB pass ----------

let db: Db;

beforeEach(async () => {
  db = await memoryDb();
  await insertAccount(db, 'black', 'card', 980, 'UA111');
  await insertAccount(db, 'usd', 'card', 840, 'UA333');
  await insertAccount(db, 'jar', 'jar', 980);
  await db.execute({ sql: `UPDATE accounts SET title = ? WHERE id = 'jar'`, args: [JAR_TITLE] });
});

afterEach(() => db.close());

async function insertTx(id: string, accountId: string, time: number, amount: number, description: string, mcc = 4829, operationAmount = amount) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount,
            currency_code, raw_json, synced_at) VALUES (?, ?, ?, '2026-08-05', ?, ?, 0, ?, ?, 980, '{}', 0)`,
    args: [id, accountId, time, description, mcc, amount, operationAmount],
  });
}

async function stored(id: string) {
  const rs = await db.execute({
    sql: 'SELECT is_internal_transfer, transfer_rule, transfer_pair_id FROM transactions WHERE id = ?',
    args: [id],
  });
  const r = rs.rows[0];
  return { internal: Number(r?.is_internal_transfer), rule: r?.transfer_rule ?? null, pair: r?.transfer_pair_id ?? null };
}

describe('markInternalTransfers (DB pass)', () => {
  it('extends the window by N seconds: a pair straddling the window edge is found', async () => {
    const windowTo = 10_000;
    await insertTx('debit', 'black', windowTo - 2, -500, JAR_TITLE);
    await insertTx('topup', 'jar', windowTo + 5, 500, '10%'); // outside [from, to]
    await markInternalTransfers(db, { from: 5_000, to: windowTo });
    expect(await stored('debit')).toEqual({ internal: 1, rule: 'pair', pair: 'topup' });
    expect(await stored('topup')).toEqual({ internal: 1, rule: 'pair', pair: 'debit' });
  });

  it('a text mark upgrades to a pair when the other half arrives in a later window', async () => {
    await insertTx('debit', 'black', 1_000, -500, JAR_TITLE);
    await markInternalTransfers(db, { from: 0, to: 1_000 });
    expect(await stored('debit')).toEqual({ internal: 1, rule: 'text', pair: null });

    await insertTx('topup', 'jar', 1_003, 500, '10%');
    await markInternalTransfers(db, { from: 1_001, to: 2_000 });
    expect(await stored('debit')).toEqual({ internal: 1, rule: 'pair', pair: 'topup' });
  });

  it('leaves pairs outside the reprocessed range alone', async () => {
    await insertTx('oldA', 'black', 100, -300, JAR_TITLE);
    await insertTx('oldB', 'jar', 101, 300, '10%');
    await markInternalTransfers(db);
    // Sentinel: a value the pass would never compute for this row. If the pass touched oldA, it would reset it.
    await db.execute(`UPDATE transactions SET transfer_rule = 'pair_fx' WHERE id = 'oldA'`);
    await insertTx('newA', 'black', 50_000, -700, JAR_TITLE);
    await markInternalTransfers(db, { from: 49_000, to: 51_000 });
    expect(await stored('oldA')).toEqual({ internal: 1, rule: 'pair_fx', pair: 'oldB' });
    expect((await stored('newA')).rule).toBe('text');
  });

  it('clears both halves when one half is cancelled', async () => {
    await insertTx('debit', 'black', 1_000, -500, JAR_TITLE, 5411); // not a template once mcc ≠ 4829 → no text mark
    await insertTx('topup', 'jar', 1_001, 500, '10%');
    await db.execute(`UPDATE transactions SET mcc = 4829 WHERE id = 'debit'`);
    await markInternalTransfers(db);
    expect((await stored('debit')).rule).toBe('pair');

    await db.execute(`UPDATE transactions SET is_cancelled = 1 WHERE id = 'debit'`);
    await markInternalTransfers(db, { from: 900, to: 1_100 });
    expect(await stored('debit')).toEqual({ internal: 0, rule: null, pair: null });
    // The top-up has no partner now; '10%' is an auto top-up template → text fallback.
    expect(await stored('topup')).toEqual({ internal: 1, rule: 'text', pair: null });
  });

  it('pair_fx through the DB pass', async () => {
    await insertTx('out', 'black', 1_000, -5_000_000, 'Переказ на картку', 4829, -111_035);
    await insertTx('in', 'usd', 1_001, 111_035, 'З Білої картки', 4829, 5_000_000);
    await markInternalTransfers(db);
    expect(await stored('out')).toEqual({ internal: 1, rule: 'pair_fx', pair: 'in' });
  });

  it('diagnostics: rows per rule and unpaired service 4829 rows', async () => {
    await insertTx('d1', 'black', 1_000, -500, JAR_TITLE);
    await insertTx('j1', 'jar', 1_001, 500, '10%');
    await insertTx('lonely', 'black', 9_000, -700, 'Переказ на картку');
    await insertTx('shop', 'black', 9_500, -100, 'Сільпо', 5411);
    await markInternalTransfers(db);
    const d = await transferDiagnostics(db);
    expect(d.byRule).toEqual({ pair: 2, pair_fx: 0, pair_fee: 0, jar_reversal: 0, iban: 0, text: 0, none: 2 });
    expect(d.unpairedService4829).toBe(1); // «Переказ на картку» without a pair
  });
});

describe('sync integration', () => {
  it('a synced window gets transfer marks and categories', async () => {
    const t = 1_750_000_000;
    const mono = fakeMonobank({
      statements: {
        black: [
          item('buy', t, -63_660, { mcc: 5411, originalMcc: 5411, description: 'Сільпо' }),
          item('debit', t, -6_366, { mcc: 4829, originalMcc: 4829, description: JAR_TITLE }),
        ],
        jar: [item('topup', t + 1, 6_366, { mcc: 4829, originalMcc: 4829, description: '10%' })],
      },
    });
    const clock = fakeClock((t + 3600) * 1000);
    const ctx: SyncContext = {
      db, clock,
      api: createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: 'wait' }),
    };
    await syncWindow(ctx, 'black', { from: t - 100, to: t + 100 });
    expect((await stored('debit')).rule).toBe('text'); // jar half not synced yet
    await syncWindow(ctx, 'jar', { from: t - 100, to: t + 100 });
    expect(await stored('debit')).toEqual({ internal: 1, rule: 'pair', pair: 'topup' });

    const cats = await db.execute('SELECT id, category FROM transactions ORDER BY id');
    expect(Object.fromEntries(cats.rows.map((r) => [String(r.id), String(r.category)]))).toEqual({
      buy: 'продукты',
      debit: 'свои переводы',
      topup: 'свои переводы',
    });
  });
});
