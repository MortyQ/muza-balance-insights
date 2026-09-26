import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exportAnalysis } from '../src/analysis/export.ts';
import { recategorize } from '@mono/core/categories';
import type { Db } from '../src/db.ts';
import { createMonoClient, type StatementItem } from '@mono/core/providers/monobank/client';
import { rederiveAll } from '../src/rederive.ts';
import {
  ScopeOverrideError,
  addScopeOverride,
  computeScope,
  overrideKey,
  listScopeOverrides,
  removeScopeOverride,
  rescope,
  scopeOverrideCandidates,
} from '@mono/core/scope';
import { SettingsError, getSettings, setSetting } from '@mono/core/settings';
import { commitWindow, type SyncContext } from '@mono/core/sync';
import { TEST_TOKEN, fakeClock, fakeMonobank, insertAccountRow, item, memoryDb } from '@mono/core/test-helpers';

let db: Db;

async function account(id: string, type: string | null, currency = 980) {
  await insertAccountRow(db, { id, kind: type === null ? 'jar' : 'card', type, currency_code: currency, balance: 0, updated_at: 0 });
}

async function tx(id: string, accountId: string, time: number, amount: number, opts: { mcc?: number; description?: string; counterName?: string } = {}) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount,
            currency_code, counter_name, raw_json, synced_at)
          VALUES (?, ?, ?, '2026-06-10', ?, ?, 0, ?, ?, 980, ?, '{}', 0)`,
    args: [id, accountId, time, opts.description ?? '', opts.mcc ?? 5411, amount, amount, opts.counterName ?? null],
  });
}

async function scopeOf(id: string) {
  const rs = await db.execute({ sql: 'SELECT scope FROM transactions WHERE id = ?', args: [id] });
  return rs.rows[0]?.scope ?? null;
}

beforeEach(async () => {
  db = await memoryDb();
  await account('black', 'black');
  await account('white', 'white');
  await account('fop', 'fop');
  await account('fopusd', 'fop', 840);
});

afterEach(() => db.close());

describe('computeScope (pure)', () => {
  const on = { treasury_business: true };
  const base = { accountType: 'black', description: 'Вигаданий Магазин', counterName: null, provider: 'monobank' as const };

  it('fop → business; a personal card → personal (incl. 9311/9399, which the rule never looks at)', () => {
    expect(computeScope({ ...base, accountType: 'fop' }, [], on)).toBe('business');
    expect(computeScope(base, [], on)).toBe('personal');
    expect(computeScope({ ...base, accountType: null }, [], on)).toBe('personal'); // jar
  });

  it('treasury from any card → business while the setting is on, personal when off', () => {
    const treasury = { ...base, accountType: 'white', description: 'ГУК Вигадана обл/12345678' };
    expect(computeScope(treasury, [], on)).toBe('business');
    expect(computeScope(treasury, [], { treasury_business: false })).toBe('personal');
  });

  it('an override beats every rule; exact beats contains; the longest contains wins', () => {
    const fine = { accountType: 'white', description: 'ГУК Вигадана обл/12345678', counterName: 'ГУК Вигаданий штраф', provider: 'monobank' as const };
    expect(computeScope(fine, [{ pattern: 'штраф', matchType: 'contains', scope: 'personal' }], on)).toBe('personal');
    const fopRow = { ...base, accountType: 'fop', counterName: 'Тестова Особа' };
    expect(computeScope(fopRow, [{ pattern: 'тестова особа', matchType: 'exact', scope: 'personal' }], on)).toBe('personal');
    expect(
      computeScope(fine, [
        { pattern: 'ГУК', matchType: 'contains', scope: 'personal' },
        { pattern: 'Вигаданий штраф', matchType: 'contains', scope: 'business' },
      ], on),
    ).toBe('business');
    expect(
      computeScope(fine, [
        { pattern: 'Вигаданий штраф', matchType: 'contains', scope: 'business' },
        { pattern: 'ГУК Вигаданий штраф', matchType: 'exact', scope: 'personal' },
      ], on),
    ).toBe('personal');
  });
});

describe('rescope (DB pass)', () => {
  it('marks FOP rows (any currency) and treasury payments business, the rest personal; writes only changes', async () => {
    await tx('shop', 'black', 1, -1_000);
    await tx('fop-fee', 'fop', 2, -500, { mcc: 4829 });
    await tx('fop-usd', 'fopusd', 3, 10_000, { mcc: 4829 });
    await tx('tax', 'white', 4, -70_000, { mcc: 4829, description: 'ГУК Вигадана обл/12345678' });
    await tx('gov', 'black', 5, -300, { mcc: 9399 });
    expect(await rescope(db)).toBe(3);
    expect(await scopeOf('shop')).toBe('personal');
    expect(await scopeOf('fop-fee')).toBe('business');
    expect(await scopeOf('fop-usd')).toBe('business');
    expect(await scopeOf('tax')).toBe('business');
    expect(await scopeOf('gov')).toBe('personal');
    expect(await rescope(db)).toBe(0);
  });

  it('a range limits the pass; a paired refund takes the purchase scope even if its purchase is outside the range', async () => {
    await tx('buy', 'fop', 100, -2_000, { mcc: 5816 });
    await tx('back', 'fop', 150, 2_000, { mcc: 4829, counterName: 'Вигаданий Сервіс' });
    await db.execute(`UPDATE transactions SET refund_pair_id = 'back' WHERE id = 'buy'`);
    await db.execute(`UPDATE transactions SET refund_pair_id = 'buy' WHERE id = 'back'`);
    await db.execute(`INSERT INTO scope_overrides (pattern, match_type, scope) VALUES ('Вигаданий Сервіс', 'exact', 'personal')`);
    await rescope(db, { from: 0, to: 120 });
    expect(await scopeOf('buy')).toBe('business');
    expect(await scopeOf('back')).toBe('personal'); // outside the range: untouched
    await rescope(db, { from: 140, to: 200 });
    expect(await scopeOf('back')).toBe('business'); // the purchase's scope beats the override, like categories
  });

  it('sync: the post-commit pass sets scope for a FOP window', async () => {
    const t = 1_750_000_000;
    const clock = fakeClock((t + 3000) * 1000);
    const mono = fakeMonobank({});
    const ctx: SyncContext = {
      db, clock,
      api: createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: 'wait' }),
    };
    const items = [{ ...item('f1', t + 10, -100), raw: '{}' }] as StatementItem[];
    await commitWindow(ctx, 'fop', { from: t, to: t + 1000 }, items);
    expect(await scopeOf('f1')).toBe('business');
  });

  it('rederiveAll (recategorize) computes scope', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-rederive-'));
    try {
      await tx('f', 'fop', 1, -100);
      const { report } = await rederiveAll(db, path.join(dir, 'a.sqlite'));
      expect(await scopeOf('f')).toBe('business');
      expect(report).toContain('Scope (строк): personal 0, business 1');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('settings', () => {
  it('defaults without rows: treasury_business on, reveal_full_names off', async () => {
    expect(await getSettings(db)).toEqual({ treasury_business: true, reveal_full_names: false });
  });

  it('set validates key and value; the default value removes the row; turning treasury off re-scopes it', async () => {
    await tx('tax', 'white', 1, -70_000, { mcc: 4829, description: 'ГУК Вигадана обл/12345678' });
    await rescope(db);
    await expect(setSetting(db, 'treasury', 'off')).rejects.toThrow(SettingsError);
    await expect(setSetting(db, 'treasury_business', 'no')).rejects.toThrow(SettingsError);

    await setSetting(db, 'treasury_business', 'off');
    expect((await getSettings(db)).treasury_business).toBe(false);
    expect(await rescope(db)).toBe(1);
    expect(await scopeOf('tax')).toBe('personal');

    await setSetting(db, 'treasury_business', 'on');
    expect((await db.execute('SELECT COUNT(*) AS n FROM settings')).rows[0]?.n).toBe(0);
    await setSetting(db, 'reveal_full_names', 'on');
    expect(await getSettings(db)).toEqual({ treasury_business: true, reveal_full_names: true });
  });
});

describe('scope overrides', () => {
  beforeEach(async () => {
    // Treasury and MCC 9311 card payments come without a counterparty: overrides match the description.
    await tx('tax', 'white', 1, -70_000, { mcc: 4829, description: 'ГУК Вигадана обл/12345678' });
    await tx('fine', 'black', 2, -3_400, { mcc: 4829, description: 'ГУК Вигаданий штраф/87654321' });
    await tx('fop-tax', 'fop', 3, -9_000, { mcc: 4829, description: 'ГУК Вигадана обл/12345678' });
    await tx('card-tax', 'black', 4, -1_500, { mcc: 9311, description: 'Вигадана Податкова' });
    await tx('p2p', 'black', 5, -800, { mcc: 4829, description: 'Вигаданий Опис', counterName: 'Тестова Особа' });
    await recategorize(db);
    await rescope(db);
  });

  it('the key is counter_name, or the description when there is no counterparty', async () => {
    expect(overrideKey({ counterName: 'Тестова Особа', description: 'Вигаданий Опис' })).toBe('Тестова Особа');
    expect(overrideKey({ counterName: '  ', description: 'ГУК Вигадана' })).toBe('ГУК Вигадана');
    expect(overrideKey({ counterName: null, description: 'ГУК Вигадана' })).toBe('ГУК Вигадана');

    await addScopeOverride(db, 'Вигаданий Опис', 'business', 'contains'); // row has a counterparty → description ignored
    expect(await scopeOf('p2p')).toBe('personal');
    await addScopeOverride(db, 'Вигадана Податкова', 'business'); // no counterparty → the description matches
    expect(await scopeOf('card-tax')).toBe('business');
  });

  it('candidates: non-FOP debits that are business or «налоги и госплатежи», keyed like overrides, by total', async () => {
    expect(await scopeOverrideCandidates(db)).toEqual([
      { key: 'ГУК Вигадана обл/12345678', scope: 'business', category: 'налоги и госплатежи', accountType: 'white', currency: 980, rows: 1, total: 70_000, lastDate: '2026-06-10' },
      { key: 'ГУК Вигаданий штраф/87654321', scope: 'business', category: 'налоги и госплатежи', accountType: 'black', currency: 980, rows: 1, total: 3_400, lastDate: '2026-06-10' },
      { key: 'Вигадана Податкова', scope: 'personal', category: 'налоги и госплатежи', accountType: 'black', currency: 980, rows: 1, total: 1_500, lastDate: '2026-06-10' },
    ]);
  });

  it('add validates, re-scopes and re-points; remove restores the rule; unknown id is an error', async () => {
    await expect(addScopeOverride(db, 'штраф', 'private', 'contains')).rejects.toThrow(ScopeOverrideError);
    await expect(addScopeOverride(db, '  ', 'personal')).rejects.toThrow(ScopeOverrideError);

    const r = await addScopeOverride(db, 'штраф', 'personal', 'contains');
    expect(r.changedRows).toBe(1);
    expect(await scopeOf('fine')).toBe('personal');
    expect(await scopeOf('tax')).toBe('business');

    const again = await addScopeOverride(db, 'штраф', 'business', 'contains');
    expect(again.id).toBe(r.id);
    expect(await listScopeOverrides(db)).toEqual([{ id: r.id, pattern: 'штраф', matchType: 'contains', scope: 'business' }]);

    await addScopeOverride(db, 'штраф', 'personal', 'contains');
    expect((await removeScopeOverride(db, r.id)).changedRows).toBe(1);
    expect(await scopeOf('fine')).toBe('business');
    await expect(removeScopeOverride(db, r.id)).rejects.toThrow(ScopeOverrideError);
  });
});

describe('analysis copy', () => {
  it('scope is exported; scope_overrides patterns and settings never reach the copy', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-export-'));
    const out = path.join(dir, 'analysis.sqlite');
    const canary = 'Canary Scope Patternenko';
    try {
      await tx('f', 'fop', 1, -100, { counterName: canary });
      await db.execute({ sql: `INSERT INTO scope_overrides (pattern, match_type, scope) VALUES (?, 'exact', 'business')`, args: [canary] });
      await db.execute(`INSERT INTO settings (key, value) VALUES ('reveal_full_names', 'on')`);
      await rescope(db);
      await exportAnalysis(db, out);
      const bytes = fs.readFileSync(out);
      expect(bytes.includes(Buffer.from(canary, 'utf8'))).toBe(false);
      expect(bytes.includes(Buffer.from('reveal_full_names', 'utf8'))).toBe(false);

      const { createClient } = await import('@libsql/client');
      const c = createClient({ url: `file:${out}` });
      try {
        expect((await c.execute('SELECT scope FROM transactions')).rows.map((r) => r.scope)).toEqual(['business']);
        const tables = (await c.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).rows.map((r) => r.name);
        expect(tables).toEqual(['accounts', 'sync_state', 'transactions']);
      } finally {
        c.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
