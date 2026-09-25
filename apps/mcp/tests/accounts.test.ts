import { afterEach, describe, expect, it } from 'vitest';
import { renderAccountsTable } from '../src/cli/accountsTable.ts';
import type { Db } from '../src/db.ts';
import { formatMinor } from '@mono/core/format';
import { createMonoClient } from '@mono/core/providers/monobank/client';
import { syncAccounts } from '@mono/core/sync';
import { TEST_TOKEN, fakeClock, fakeMonobank, memoryDb } from '@mono/core/test-helpers';

let db: Db;
afterEach(() => db?.close());

describe('accounts table', () => {
  it('shows id, kind, type, currency, balance — never IBAN or card numbers', async () => {
    db = await memoryDb();
    const clock = fakeClock();
    const mono = fakeMonobank({
      accounts: [{ id: 'card1', iban: 'UA213223130000026007233566001', currencyCode: 840 }],
      jars: [{ id: 'jar1', title: 'Відпустка', balance: 0 }],
    });
    await syncAccounts({ db, clock, api: createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock }) });

    const out = (await renderAccountsTable(db)).join('\n');
    expect(out).toMatch(/card1\s+card\s+black\s+USD\s+10\.00\s+да/);
    expect(out).toMatch(/jar1\s+jar\s+«Відпустка»\s+UAH\s+0\.00\s+нет \(--account\)/);
    for (const leak of ['UA213223130000026007233566001', '537541', '******', TEST_TOKEN]) {
      expect(out).not.toContain(leak);
    }
  });
});

describe('formatMinor', () => {
  it('integer-only formatting', () => {
    expect(formatMinor(123456)).toBe('1234.56');
    expect(formatMinor(-5)).toBe('-0.05');
    expect(formatMinor(0)).toBe('0.00');
    expect(formatMinor(-100)).toBe('-1.00');
    expect(() => formatMinor(1.5)).toThrow();
  });
});
