// A failure in the derived-data pass (transfers / categories) must not break the sync.
// Separate file: vi.mock replaces src/categories.ts for every test in the file.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../src/db.ts';
import { createMonoClient } from '../src/providers/monobank/client.ts';
import { getSyncState, runPlan, type SyncContext, type Window } from '../src/sync.ts';
import { TEST_TOKEN, fakeClock, fakeMonobank, insertAccount, item, memoryDb } from './helpers.ts';

vi.mock('../src/categories.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/categories.ts')>()),
  recategorize: vi.fn(async () => {
    throw new Error('categories exploded');
  }),
}));

let db: Db;
afterEach(() => db?.close());

describe('sync with a failing categories pass', () => {
  it('keeps the committed window, advances sync_state, warns and continues with the next window', async () => {
    db = await memoryDb();
    await insertAccount(db, 'black');
    const t = 1_750_000_000;
    const w1: Window = { from: t, to: t + 1000 };
    const w2: Window = { from: t + 1000, to: t + 2000 };
    const mono = fakeMonobank({
      statements: { black: [item('a', t + 10, -100), item('b', t + 1500, -200)] },
    });
    const clock = fakeClock((t + 3000) * 1000);
    const warnings: string[] = [];
    const ctx: SyncContext = {
      db, clock,
      api: createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: 'wait' }),
      warn: (m) => warnings.push(m),
    };

    await expect(runPlan(ctx, new Map([['black', [w1, w2]]]))).resolves.toBeUndefined();

    const rows = await db.execute('SELECT id FROM transactions ORDER BY id');
    expect(rows.rows.map((r) => String(r.id))).toEqual(['a', 'b']); // both windows committed
    expect(await getSyncState(db, 'black')).toMatchObject({ oldest: w1.from, newest: w2.to });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/сохранено, но разметка .* не обновлена \(categories exploded\).*Запусти recategorize/);
  });
});
