// File connections and statement uploads in main, on a real database: what the renderer gets (counts, dates, codes —
// never the path or the text), the kept statement's life, and that the import never sees a file connection.
// Invented data only (the core's fixtures).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@mono/core/db';
import { memoryDb } from '@mono/core/test-helpers';
import { DataService } from '../src/main/data.ts';
import { STATEMENT_KEEP_MS, STATEMENT_MAX_BYTES, StatementsService } from '../src/main/statements.ts';
import { TokenError } from '../src/main/token.ts';
import { TOKEN, services } from './helpers/people.ts';

const FIXTURES = path.resolve(__dirname, '../../../packages/core/tests/providers/monobank/fixtures');

let dir: string;
let db: Db;
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'statements-'));
  db = await memoryDb();
});
afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function harness(opts: { file?: string | null; running?: boolean } = {}) {
  const logs: string[] = [];
  let now = 1_800_000_000_000;
  let ids = 0;
  const svc = new StatementsService({
    db: async () => db,
    pickFile: async () => (opts.file === undefined ? path.join(FIXTURES, 'statement-card-uk.csv') : opts.file),
    importRunning: () => opts.running ?? false,
    randomId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`,
    nowMs: () => now,
    timeZone: () => 'Europe/Kyiv',
    log: (m) => logs.push(m),
  });
  return { svc, logs, advance: (ms: number) => (now += ms) };
}

async function fileConnection(): Promise<number> {
  const { integrations } = services(db, dir);
  const r = await integrations.addConnection({ participant: { label: 'Вигадана Особа' }, provider: 'monobank', method: 'file' });
  if (!r.added) throw new Error('not added');
  return r.connectionId;
}

describe('a file connection', () => {
  it('is added without a token; the list shows its way and no token; it takes no token later', async () => {
    const { integrations, people, vault } = services(db, dir);
    const r = await integrations.addConnection({ participant: { label: 'Вигадана Особа' }, provider: 'monobank', method: 'file' });
    expect(r).toMatchObject({ added: true, stored: null });
    if (!r.added) throw new Error('not added');
    expect(fs.readdirSync(dir)).toEqual([]);
    expect(await vault.get(r.connectionId)).toBeNull();
    const [person] = (await people.list()).people;
    expect(person?.connections.map((c) => [c.method, c.token])).toEqual([['file', null]]);
    await expect(integrations.setToken(r.connectionId, TOKEN, true)).rejects.toBeInstanceOf(TokenError);
  });

  it('the import never takes it: DataService.connections lists token connections only', async () => {
    const { integrations } = services(db, dir);
    const tokenOne = await integrations.addConnection({ participant: { label: 'Вигадана Особа' }, provider: 'monobank', token: TOKEN, remember: true });
    await fileConnection();
    const data = new DataService({ open: async () => db, release: async () => undefined, nowSec: () => 0, rates: async () => null });
    expect(await data.connections()).toEqual([{ connectionId: tokenOne.added ? tokenOne.connectionId : -1, provider: 'monobank' }]);
  });
});

describe('StatementsService', () => {
  it('open → compare → commit a new card; the reply has counts and dates only, the log no path', async () => {
    const conn = await fileConnection();
    const { svc, logs } = harness();
    const opened = await svc.open(conn);
    expect(opened).toEqual({
      opened: true, statementId: expect.any(String), currencyCode: 980, rows: 5, from: '2026-10-03', to: '2026-10-07', accounts: [],
    });
    if (!opened.opened) throw new Error('not opened');
    const target = { kind: 'new', type: 'black' } as const;
    expect(await svc.compare(opened.statementId, target)).toEqual({
      ok: true, comparison: { rows: 5, matched: 0, amountDiffers: 0, added: 5, missingInFile: 0, gap: null, blocked: null },
    });
    expect(await svc.commit(opened.statementId, target)).toEqual({ written: true, added: 5 });
    // Written once: the kept statement is gone.
    expect(await svc.commit(opened.statementId, target)).toEqual({ written: false, reason: 'expired' });

    const again = await svc.open(conn);
    if (!again.opened) throw new Error('not opened');
    expect(again.accounts.map((a) => [a.kind, a.type, a.currencyCode])).toEqual([['card', 'black', 980]]);
    expect(await svc.compare(again.statementId, { kind: 'account', accountId: again.accounts[0]!.id })).toMatchObject({ ok: true, comparison: { matched: 5, added: 0 } });

    const text = JSON.stringify([opened, again, logs]);
    for (const leak of [FIXTURES, 'statement-card-uk', 'Тест Маркет', 'Від:']) expect(text).not.toContain(leak);
    expect(logs).toEqual(['[statement] opened 5', '[statement] added 5', '[statement] opened 5']);
  });

  it('a token connection: compared, not written', async () => {
    const { integrations } = services(db, dir);
    const r = await integrations.addConnection({ participant: { label: 'Вигадана Особа' }, provider: 'monobank', token: TOKEN, remember: true });
    if (!r.added) throw new Error('not added');
    const { svc } = harness();
    const opened = await svc.open(r.connectionId);
    if (!opened.opened) throw new Error('not opened');
    expect(await svc.compare(opened.statementId, { kind: 'new', type: null })).toMatchObject({ ok: true, comparison: { blocked: 'token' } });
    expect(await svc.commit(opened.statementId, { kind: 'new', type: null })).toEqual({ written: false, reason: 'token' });
  });

  it('a cancelled dialog, a refused file, a file past the limit, bytes that are not UTF-8', async () => {
    const conn = await fileConnection();
    expect(await harness({ file: null }).svc.open(conn)).toEqual({ opened: false, reason: 'cancelled' });
    expect(await harness({ file: path.join(FIXTURES, 'statement-card.csv') }).svc.open(conn)).toEqual({ opened: false, reason: 'problem', problem: 'english', row: null });
    expect(await harness({ file: path.join(FIXTURES, 'statement-fop.csv') }).svc.open(conn)).toEqual({ opened: false, reason: 'problem', problem: 'unsupported-kind', row: null });

    const big = path.join(dir, 'big.csv');
    fs.writeFileSync(big, '');
    fs.truncateSync(big, STATEMENT_MAX_BYTES + 1);
    expect(await harness({ file: big }).svc.open(conn)).toEqual({ opened: false, reason: 'problem', problem: 'too-large', row: null });

    const latin1 = path.join(dir, 'latin1.csv');
    fs.writeFileSync(latin1, Buffer.from([0x22, 0xc4, 0xe0, 0xf2, 0xe0, 0x22, 0x0a]));
    expect(await harness({ file: latin1 }).svc.open(conn)).toEqual({ opened: false, reason: 'problem', problem: 'unknown-format', row: null });

    const badRow = path.join(dir, 'bad.csv');
    const lines = fs.readFileSync(path.join(FIXTURES, 'statement-card-uk.csv'), 'utf8').split('\n');
    lines[2] = lines[2]!.replace('-1005.00', '-1005.005');
    fs.writeFileSync(badRow, lines.join('\n'));
    expect(await harness({ file: badRow }).svc.open(conn)).toEqual({ opened: false, reason: 'problem', problem: 'bad-row', row: 3 });
  });

  it('the kept statement: one at a time, 10 minutes, gone on forget; an unknown connection is refused', async () => {
    const conn = await fileConnection();
    const { svc, advance } = harness();
    const first = await svc.open(conn);
    const second = await svc.open(conn);
    if (!first.opened || !second.opened) throw new Error('not opened');
    const target = { kind: 'new', type: null } as const;
    expect(await svc.compare(first.statementId, target)).toEqual({ ok: false, reason: 'expired' });
    advance(STATEMENT_KEEP_MS + 1);
    expect(await svc.compare(second.statementId, target)).toEqual({ ok: false, reason: 'expired' });

    const third = await svc.open(conn);
    if (!third.opened) throw new Error('not opened');
    svc.forget();
    expect(await svc.commit(third.statementId, target)).toEqual({ written: false, reason: 'expired' });
    await expect(svc.open(999)).rejects.toThrow(/No such connection/);
  });

  it('refused while an import runs; the statement stays for a retry', async () => {
    const conn = await fileConnection();
    const running = { value: true };
    const svc = new StatementsService({
      db: async () => db,
      pickFile: async () => path.join(FIXTURES, 'statement-card-uk.csv'),
      importRunning: () => running.value,
      randomId: () => '00000000-0000-4000-8000-000000000001',
      nowMs: () => 0,
      timeZone: () => 'Europe/Kyiv',
      log: () => undefined,
    });
    const opened = await svc.open(conn);
    if (!opened.opened) throw new Error('not opened');
    expect(await svc.commit(opened.statementId, { kind: 'new', type: null })).toEqual({ written: false, reason: 'import-running' });
    running.value = false;
    expect(await svc.commit(opened.statementId, { kind: 'new', type: null })).toEqual({ written: true, added: 5 });
  });
});
