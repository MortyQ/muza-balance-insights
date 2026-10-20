// Fictional data for the performance harness (bench/run.ts) — never real data. Every name, IBAN and merchant is made
// up; IBANs carry «BENCH» so none can pass for a real one. Seeded: the same options give the same rows.
// The shapes follow the Monobank provider rules, so the derivation passes find every kind of mark they know: own
// pairs (same currency, fx, with a fee), jar top-ups, an IBAN match, own-transfer texts, family transfers, refunds
// with a different MCC, holds, commissions — and a jar the auto rule disables, so statistics see crossing rows.
import { migrate, type Db, type SqlArg, type Stmt } from '../src/db.ts';
import { toKyivDate } from '../src/format.ts';

export type BenchOptions = {
  seed: number;
  /** Operations to generate; a transfer pair counts as two. */
  operations: number;
  /** History length, days back from endSec. */
  days: number;
  /** The last instant of the history, unix seconds. */
  endSec: number;
  /** Size of each operation's stored bank payload, bytes (the stored original item). */
  payloadBytes: number;
};

export const DEFAULT_BENCH: BenchOptions = {
  seed: 1,
  operations: 40_000,
  days: 3 * 365,
  endSec: Math.floor(Date.UTC(2026, 9, 18, 12) / 1000),
  payloadBytes: 1000,
};

export type BenchParticipant = { id: number; label: string };
export type BenchConnection = { id: number; participantId: number; externalClientId: string };
export type BenchAccount = {
  id: string;
  connectionId: number;
  kind: 'card' | 'jar';
  type: string | null;
  currencyCode: number;
  iban: string | null;
  title: string | null;
  balance: number;
  /** false: no coverage record — with balance 0 the auto rule disables a jar. */
  covered: boolean;
};
export type BenchTx = {
  id: string;
  accountId: string;
  time: number;
  description: string;
  mcc: number;
  hold: 0 | 1;
  amount: number;
  operationAmount: number;
  currencyCode: number;
  commissionRate: number;
  balance: number;
  counterName: string | null;
  counterIban: string | null;
  isCancelled: 0 | 1;
  rawJson: string;
};
export type BenchDataset = {
  options: BenchOptions;
  participants: BenchParticipant[];
  connections: BenchConnection[];
  accounts: BenchAccount[];
  transactions: BenchTx[];
};

const iban = (n: number) => `UA00BENCH${String(n).padStart(20, '0')}`;
const JAR = 'Bench jar';
const EMPTY_JAR = 'Empty bench jar';

const ACCOUNTS: readonly Omit<BenchAccount, 'balance'>[] = [
  { id: 'bench-a-black', connectionId: 1, kind: 'card', type: 'black', currencyCode: 980, iban: iban(1), title: null, covered: true },
  { id: 'bench-a-white', connectionId: 1, kind: 'card', type: 'white', currencyCode: 980, iban: iban(2), title: null, covered: true },
  { id: 'bench-a-usd', connectionId: 1, kind: 'card', type: 'black', currencyCode: 840, iban: iban(3), title: null, covered: true },
  { id: 'bench-a-fop', connectionId: 1, kind: 'card', type: 'fop', currencyCode: 980, iban: iban(4), title: null, covered: true },
  { id: 'bench-a-jar', connectionId: 1, kind: 'jar', type: null, currencyCode: 980, iban: null, title: JAR, covered: true },
  { id: 'bench-a-jar-empty', connectionId: 1, kind: 'jar', type: null, currencyCode: 980, iban: null, title: EMPTY_JAR, covered: false },
  { id: 'bench-b-black', connectionId: 2, kind: 'card', type: 'black', currencyCode: 980, iban: iban(5), title: null, covered: true },
];
const SPENDING_ACCOUNTS = ['bench-a-black', 'bench-a-white', 'bench-a-usd', 'bench-b-black'];
const MCCS = [5411, 5812, 5814, 4121, 5912, 5999, 5732, 4111, 5541, 5651, 7832, 8099];
const USD_RATE = 41;

/** mulberry32: a small seeded PRNG, enough for reproducible fictional data. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Draft = Omit<BenchTx, 'id' | 'balance' | 'rawJson' | 'isCancelled' | 'hold' | 'commissionRate' | 'counterName' | 'counterIban' | 'operationAmount' | 'currencyCode'> &
  Partial<Pick<BenchTx, 'hold' | 'isCancelled' | 'commissionRate' | 'counterName' | 'counterIban' | 'operationAmount' | 'currencyCode'>>;

export function generateDataset(opts: BenchOptions = DEFAULT_BENCH): BenchDataset {
  const rnd = prng(opts.seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const startSec = opts.endSec - opts.days * 86_400;
  const currencyOf = new Map(ACCOUNTS.map((a) => [a.id, a.currencyCode]));

  const drafts: Draft[] = [];
  const add = (d: Draft) => drafts.push(d);
  // Paired rows: the credit 0–14 s after the debit, as the bank does.
  const pair = (out: Draft, inn: Omit<Draft, 'time'>) => (add(out), add({ ...inn, time: out.time + int(0, 14) }));

  while (drafts.length < opts.operations) {
    const time = int(startSec, opts.endSec - 60);
    const r = rnd();
    const uah = int(50, 4000) * 100;
    if (r < 0.66) {
      const acc = pick(SPENDING_ACCOUNTS);
      const amount = currencyOf.get(acc) === 840 ? -Math.max(100, Math.round(uah / USD_RATE)) : -uah;
      const recent = time > opts.endSec - 3 * 86_400;
      add({
        accountId: acc,
        time,
        description: `Bench merchant ${int(1, 400)}`,
        mcc: pick(MCCS),
        amount,
        commissionRate: rnd() < 0.02 ? int(5, 50) * 100 : 0,
        hold: recent && rnd() < 0.3 ? 1 : 0,
        isCancelled: recent && rnd() < 0.05 ? 1 : 0,
      });
    } else if (r < 0.69) {
      // A refund with a different MCC: a transfer-coded credit 0–15 min after the purchase.
      const purchase: Draft = { accountId: 'bench-a-black', time, description: `Bench shop ${int(1, 50)}`, mcc: pick(MCCS), amount: -uah };
      add(purchase);
      add({ accountId: 'bench-a-black', time: time + int(30, 900), description: purchase.description, mcc: 4829, amount: uah });
    } else if (r < 0.71) {
      add({ accountId: 'bench-a-black', time, description: `Bench store ${int(1, 50)}`, mcc: 5411, amount: Math.round(uah / 3) });
    } else if (r < 0.75) {
      add({ accountId: pick(['bench-a-black', 'bench-b-black']), time, description: `Від: Bench sender ${int(1, 20)}`, mcc: 4829, amount: uah * 5 });
    } else if (r < 0.76) {
      add({ accountId: 'bench-a-black', time, description: 'Bench other bank', mcc: 6012, amount: uah * 3 });
    } else if (r < 0.83) {
      pair(
        { accountId: 'bench-a-black', time, description: 'На білу картку', mcc: 4829, amount: -uah },
        { accountId: 'bench-a-white', description: 'З Чорної картки', mcc: 4829, amount: uah },
      );
    } else if (r < 0.84) {
      const usd = int(10, 300) * 100;
      pair(
        { accountId: 'bench-a-usd', time, description: 'Bench exchange', mcc: 4829, amount: -usd, operationAmount: -usd * USD_RATE, currencyCode: 980 },
        { accountId: 'bench-a-black', description: 'Bench exchange', mcc: 4829, amount: usd * USD_RATE, operationAmount: usd, currencyCode: 840 },
      );
    } else if (r < 0.85) {
      const fee = int(5, 30) * 100;
      pair(
        { accountId: 'bench-a-black', time, description: 'На білу картку', mcc: 4829, amount: -(uah + fee), operationAmount: -uah, commissionRate: fee },
        { accountId: 'bench-a-white', description: 'З Чорної картки', mcc: 4829, amount: uah },
      );
    } else if (r < 0.9) {
      pair(
        { accountId: 'bench-a-black', time, description: `Регулярне поповнення «${JAR}»`, mcc: 4829, amount: -uah },
        { accountId: 'bench-a-jar', description: 'З Чорної картки', mcc: 4829, amount: uah },
      );
    } else if (r < 0.91) {
      // Into the jar the auto rule disables: pairs with rows on it, and text-only rows without a pair.
      if (rnd() < 0.5) {
        pair(
          { accountId: 'bench-a-black', time, description: `Регулярне поповнення «${EMPTY_JAR}»`, mcc: 4829, amount: -uah },
          { accountId: 'bench-a-jar-empty', description: 'З Чорної картки', mcc: 4829, amount: uah },
        );
      } else {
        add({ accountId: 'bench-a-black', time, description: `Округлення балансу «${EMPTY_JAR}»`, mcc: 4829, amount: -int(1, 99) * 100 });
      }
    } else if (r < 0.93) {
      pair(
        { accountId: 'bench-a-black', time, description: 'Переказ на картку', mcc: 4829, amount: -uah },
        { accountId: 'bench-b-black', description: 'Від: Bench person A', mcc: 4829, amount: uah },
      );
    } else if (r < 0.94) {
      add({ accountId: 'bench-a-black', time, description: 'Bench own iban', mcc: 4829, amount: -uah, counterIban: iban(2) });
    } else if (r < 0.95) {
      add({ accountId: 'bench-a-fop', time, description: 'ГУК bench treasury', mcc: 4829, amount: -uah });
    } else if (r < 0.96) {
      add({ accountId: 'bench-a-fop', time, description: `Від: Bench client ${int(1, 10)}`, mcc: 4829, amount: uah * 10, counterName: `Bench client ${int(1, 10)}` });
    } else if (r < 0.97) {
      add({ accountId: 'bench-a-black', time, description: 'Щомісячний платіж', mcc: 4829, amount: -uah });
    } else {
      add({ accountId: 'bench-a-black', time, description: `Bench person ${int(1, 30)}`, mcc: 4829, amount: -uah, counterName: `Bench person ${int(1, 30)}` });
    }
  }

  drafts.sort((x, y) => x.time - y.time || x.accountId.localeCompare(y.accountId));
  const balances = new Map(ACCOUNTS.map((a) => [a.id, 0]));
  const pad = 'x'.repeat(Math.max(0, opts.payloadBytes - 64));
  const transactions: BenchTx[] = drafts.map((d, i) => {
    const id = `bench-tx-${opts.seed}-${i}`;
    const balance = (balances.get(d.accountId) ?? 0) + (d.isCancelled ? 0 : d.amount);
    balances.set(d.accountId, balance);
    return {
      id,
      accountId: d.accountId,
      time: d.time,
      description: d.description,
      mcc: d.mcc,
      hold: d.hold ?? 0,
      amount: d.amount,
      operationAmount: d.operationAmount ?? d.amount,
      currencyCode: d.currencyCode ?? currencyOf.get(d.accountId) ?? 980,
      commissionRate: d.commissionRate ?? 0,
      balance,
      counterName: d.counterName ?? null,
      counterIban: d.counterIban ?? null,
      isCancelled: d.isCancelled ?? 0,
      rawJson: JSON.stringify({ id, time: d.time, amount: d.amount, pad }),
    };
  });

  return {
    options: opts,
    participants: [
      { id: 1, label: 'Bench person A' },
      { id: 2, label: 'Bench person B' },
    ],
    connections: [
      { id: 1, participantId: 1, externalClientId: 'bench-client-1' },
      { id: 2, participantId: 2, externalClientId: 'bench-client-2' },
    ],
    // The disabled jar stays empty whatever went through it: the auto rule needs balance 0 and no coverage.
    accounts: ACCOUNTS.map((a) => ({ ...a, balance: a.id === 'bench-a-jar-empty' ? 0 : Math.max(0, balances.get(a.id) ?? 0) + 1_000_000 })),
    transactions,
  };
}

/** Writes a dataset into a migrated, empty database (derived columns stay at their defaults: run rederiveCore next). */
export async function loadDataset(db: Db, ds: BenchDataset): Promise<void> {
  const now = ds.options.endSec;
  await migrate(db, now);
  const startSec = now - ds.options.days * 86_400;
  const head: Stmt[] = [
    ...ds.participants.map((p, i) => ({
      sql: 'INSERT INTO participants (id, label, sort, created_at) VALUES (?, ?, ?, ?)',
      args: [p.id, p.label, i, startSec],
    })),
    ...ds.connections.map((c) => ({
      sql: "INSERT INTO connections (id, participant_id, provider, external_client_id, created_at) VALUES (?, ?, 'monobank', ?, ?)",
      args: [c.id, c.participantId, c.externalClientId, startSec],
    })),
    ...ds.accounts.map((a) => ({
      sql: `INSERT INTO accounts (id, connection_id, kind, type, currency_code, iban, masked_pan, title, goal, balance, credit_limit, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?)`,
      args: [a.id, a.connectionId, a.kind, a.type, a.currencyCode, a.iban, a.title, a.balance, a.kind === 'card' ? 0 : null, now],
    })),
    ...ds.accounts
      .filter((a) => a.covered)
      .map((a) => ({
        sql: 'INSERT INTO sync_state (account_id, oldest_synced_time, newest_synced_time, last_sync_at) VALUES (?, ?, ?, ?)',
        args: [a.id, startSec, now, now],
      })),
  ];
  await db.batch(head);
  const CHUNK = 2000;
  for (let i = 0; i < ds.transactions.length; i += CHUNK) {
    await db.batch(ds.transactions.slice(i, i + CHUNK).flatMap(insertTx(now)));
  }
}

const insertTx =
  (syncedAt: number) =>
  (t: BenchTx): Stmt[] => [
    {
      sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount,
              currency_code, commission_rate, balance, counter_name, counter_iban, synced_at, is_cancelled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        t.id, t.accountId, t.time, toKyivDate(t.time), t.description, t.mcc, t.hold, t.amount,
        t.operationAmount, t.currencyCode, t.commissionRate, t.balance, t.counterName, t.counterIban, syncedAt,
        t.isCancelled,
      ] satisfies SqlArg[],
    },
    { sql: 'INSERT INTO transaction_raw (id, raw_json) VALUES (?, ?)', args: [t.id, t.rawJson] },
  ];
