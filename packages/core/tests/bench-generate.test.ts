import { describe, expect, it } from 'vitest';
import { generateDataset, loadDataset, type BenchOptions } from '../bench/generate.ts';
import { rederiveCore } from '../src/rederive.ts';
import { memoryDb } from './helpers.ts';

const SMALL: BenchOptions = { seed: 7, operations: 3000, days: 400, endSec: Math.floor(Date.UTC(2026, 9, 18, 12) / 1000), payloadBytes: 200 };

describe('bench dataset', () => {
  it('is the same for the same seed and differs for another', () => {
    expect(generateDataset(SMALL)).toEqual(generateDataset(SMALL));
    expect(generateDataset({ ...SMALL, seed: 8 }).transactions).not.toEqual(generateDataset(SMALL).transactions);
  });

  it('holds only fictional IBANs and names', () => {
    const ds = generateDataset(SMALL);
    const ibans = [...ds.accounts.map((a) => a.iban), ...ds.transactions.map((t) => t.counterIban)].filter((x) => x !== null);
    expect(ibans.length).toBeGreaterThan(0);
    for (const i of ibans) expect(i).toMatch(/^UA00BENCH\d{20}$/);
    const names = [...ds.participants.map((p) => p.label), ...ds.transactions.map((t) => t.counterName)].filter((x) => x !== null);
    for (const n of names) expect(n).toMatch(/^Bench /);
  });

  it('gives the derivation every kind of mark and a disabled account', async () => {
    const db = await memoryDb();
    try {
      await loadDataset(db, generateDataset(SMALL));
      await rederiveCore(db);
      const rules = (await db.execute('SELECT DISTINCT transfer_rule AS r FROM transactions WHERE transfer_rule IS NOT NULL')).rows.map((r) => String(r.r));
      for (const r of ['family', 'iban', 'pair', 'pair_fee', 'pair_fx', 'text']) expect(rules).toContain(r);
      const refunds = await db.execute('SELECT COUNT(*) AS n FROM transactions WHERE refund_pair_id IS NOT NULL');
      expect(Number(refunds.rows[0]?.n)).toBeGreaterThan(0);
      const business = await db.execute("SELECT COUNT(*) AS n FROM transactions WHERE scope = 'business'");
      expect(Number(business.rows[0]?.n)).toBeGreaterThan(0);
      const disabled = await db.execute(
        "SELECT id FROM accounts WHERE NOT COALESCE(sync_choice, kind = 'card' OR balance > 0 OR EXISTS (SELECT 1 FROM sync_state s WHERE s.account_id = accounts.id))",
      );
      expect(disabled.rows.map((r) => String(r.id))).toEqual(['bench-a-jar-empty']);
    } finally {
      db.close();
    }
  });
});
