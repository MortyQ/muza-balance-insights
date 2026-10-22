// How many statements the home screen's overviews run: a fixed number per overview, whatever the number of people,
// accounts and months of history — grouped queries instead of one per person, account or month. Fictional data only.
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '@mono/core/storage/db';
import { kyivStartOfDay } from '@mono/core/shared/format';
import { addConnection, addParticipant } from '@mono/core/people/participants';
import { rederiveCore } from '@mono/core/derive/rederive';
import { insertAccountRow, memoryDb, testConnection } from '@mono/core/test-helpers';
import { DataService } from '../src/data/data.ts';
import type { RatesView } from '../src/shared/api.ts';

const NOW = kyivStartOfDay('2026-03-15') + 12 * 3600;
const SYNCED_TO = kyivStartOfDay('2026-03-15') + 9 * 3600;
const RATES: RatesView = { list: [{ currency: 840, rate: 40 }], fetchedAt: NOW - 3600, saved: false };

type World = { people: number; accounts: number; months: number };

let db: Db | null = null;
afterEach(() => db?.close());

/** `accounts` accounts dealt round the people (a dollar card and a jar among them), `months` months of history each. */
async function world(w: World): Promise<{ svc: DataService; count: () => number; reset: () => void; people: number[] }> {
  const d = await memoryDb();
  db = d;
  const connections = [await testConnection(d)];
  for (let p = 1; p < w.people; p++) connections.push(await addConnection(d, await addParticipant(d, { label: `Person ${p}` }, 0), 'monobank', 0));
  const oldest = kyivStartOfDay(new Date(Date.UTC(2026, 2 - w.months, 1)).toISOString().slice(0, 10));
  let seq = 0;
  for (let i = 0; i < w.accounts; i++) {
    const id = `acc${i}`;
    const jar = i % 4 === 3;
    const currency = i % 4 === 2 ? 840 : 980;
    await insertAccountRow(d, {
      id, connection_id: connections[i % connections.length]!, kind: jar ? 'jar' : 'card', type: jar ? null : 'black', currency_code: currency,
      iban: `UA00FICTIONAL${i}`, balance: 100_000, credit_limit: 0, updated_at: SYNCED_TO,
    });
    await d.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: [id, oldest, SYNCED_TO, SYNCED_TO] });
    for (let t = oldest + 86_400 + i * 600; t < SYNCED_TO; t += 5 * 86_400) {
      const n = ++seq;
      await d.execute({
        sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code, commission_rate, balance, synced_at)
              VALUES (?, ?, ?, '2026-01-01', 'Fictional shop', ?, 0, ?, ?, ?, ?, 0)`,
        args: [`t${n}`, id, t, n % 3 === 0 ? 4829 : 5411, n % 3 === 0 ? 50_000 : -12_000, currency, n % 5 === 0 ? 100 : 0, 100_000 + n],
      });
    }
  }
  await rederiveCore(d);
  let n = 0;
  const spy: Db = {
    execute: (s) => ((n += 1), d.execute(s)),
    batch: (ss) => ((n += ss.length), d.batch(ss)),
    close: () => undefined,
  };
  const svc = new DataService({ open: async () => spy, release: async () => undefined, nowSec: () => NOW, rates: async () => RATES });
  await svc.status(); // opening runs the migrations and the crossing refresh: not part of any overview
  const people = (await d.execute('SELECT id FROM participants ORDER BY id')).rows.map((r) => Number(r.id));
  return { svc, count: () => n, reset: () => (n = 0), people };
}

/** The statements each overview runs in this world, for the family and for its first person. */
async function counts(w: World): Promise<Record<string, number>> {
  const { svc, count, reset, people } = await world(w);
  const out: Record<string, number> = {};
  const run = async (name: string, f: () => Promise<unknown>) => {
    reset();
    await f();
    out[name] = count();
  };
  const me = people[0]!;
  await run('month, family', () => svc.monthOverview({ month: '2026-03' }));
  await run('month, person', () => svc.monthOverview({ month: '2026-03', participantId: me }));
  await run('past month, family', () => svc.monthOverview({ month: '2026-02' }));
  await run('now, family', () => svc.nowOverview({}));
  await run('now, person', () => svc.nowOverview({ participantId: me }));
  // The usual months (past month: income too). The family's per-person split of the block runs per person and is not
  // counted here.
  await run('spending, person', () => svc.spendingOverview({ month: '2026-03', scope: 'personal', participantId: me }));
  await run('spending, past month, person', () => svc.spendingOverview({ month: '2026-02', scope: 'personal', participantId: me }));
  db?.close();
  db = null;
  return out;
}

describe('the overviews run a fixed number of statements', () => {
  it('whatever the number of people', async () => {
    // A person's spending block adds the family's total once there is more than one person: compared from two on.
    const withoutSpending = (c: Record<string, number>) => Object.fromEntries(Object.entries(c).filter(([k]) => !k.startsWith('spending')));
    const three = await counts({ people: 3, accounts: 6, months: 8 });
    expect(withoutSpending(three)).toEqual(withoutSpending(await counts({ people: 1, accounts: 6, months: 8 })));
    expect(three).toEqual(await counts({ people: 2, accounts: 6, months: 8 }));
  });

  it('whatever the number of accounts', async () => {
    expect(await counts({ people: 2, accounts: 8, months: 8 })).toEqual(await counts({ people: 2, accounts: 2, months: 8 }));
  });

  it('whatever the length of the history', async () => {
    expect(await counts({ people: 2, accounts: 4, months: 36 })).toEqual(await counts({ people: 2, accounts: 4, months: 3 }));
  });
});
