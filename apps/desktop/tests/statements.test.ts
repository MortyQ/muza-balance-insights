// File connections and statement uploads in main, on a real database: what the renderer gets (counts, dates, codes —
// never the path or the content), the kept statement's life, the file's kind by its bytes, the decoder's refusals, a
// file of several accounts, and that the import never sees a file connection. Invented data only (the core's
// fixtures); two invented readers join the real registry: another bank's, and a Monobank spreadsheet of two cards.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParsedStatement, ProviderId, StatementReader } from '@mono/core/providers/types';
import type { Db } from '@mono/core/storage/db';
import { memoryDb } from '@mono/core/test-helpers';
import { DataService } from '../src/data/data.ts';
import type { DecodeOutcome } from '../src/main/decoder-client.ts';
import { STATEMENT_KEEP_MS, STATEMENT_MAX_BYTES, StatementsService } from '../src/main/statements.ts';
import type { DecodeFormat } from '../src/shared/decoder-protocol.ts';
import { TokenError } from '../src/main/token.ts';
import { TOKEN, localData, services } from './helpers/people.ts';

const FIXTURES = path.resolve(__dirname, '../../../packages/core/tests/providers/monobank/fixtures');
const IBAN = 'UA003000000000000000000000001';

vi.mock('@mono/core/providers/statements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mono/core/providers/statements')>();
  const nodeFs = await import('node:fs');
  const nodePath = await import('node:path');
  const fixtures = nodePath.resolve(__dirname, '../../../packages/core/tests/providers/monobank/fixtures');
  const card = actual.STATEMENT_READERS.monobank[0]!.read({ format: 'text', text: nodeFs.readFileSync(nodePath.join(fixtures, 'statement-card-uk.csv'), 'utf8') });
  if (!card.ok) throw new Error('fixture');
  const [uah] = card.statements as [ParsedStatement];
  const usd: ParsedStatement = {
    ...uah,
    currencyCode: 840,
    account: { iban: 'UA003000000000000000000000001', cards: ['4441 11** **** 1111'], type: 'white' },
    rows: uah.rows.slice(0, 2).map((r) => ({ ...r, currencyCode: 840 })),
  };
  const other: StatementReader = {
    provider: 'otherbank' as ProviderId,
    id: 'otherbank-card',
    extensions: ['xls'],
    detect: (d) => (d.format === 'text' && d.text.startsWith('OTHERBANK') ? 2 : 0),
    read: () => ({ ok: false, problem: 'empty' }),
  };
  const twoCards: StatementReader = {
    provider: 'monobank',
    id: 'monobank-two-cards',
    extensions: ['xlsx', 'csv'],
    detect: (d) => (d.format === 'sheets' ? 2 : 0),
    read: () => ({ ok: true, statements: [uah, usd] }),
  };
  const monobank = [...actual.STATEMENT_READERS.monobank, twoCards];
  return {
    ...actual,
    STATEMENT_READERS: { ...actual.STATEMENT_READERS, monobank },
    pickReader: (doc: Parameters<typeof actual.pickReader>[0]) => actual.pickReader(doc, [...monobank, other]),
  };
});

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

function harness(opts: { file?: string | null; running?: boolean; decoded?: DecodeOutcome } = {}) {
  const logs: string[] = [];
  const picked: Array<readonly string[]> = [];
  const decoded: Array<[DecodeFormat, number]> = [];
  let now = 1_800_000_000_000;
  let ids = 0;
  const svc = new StatementsService({
    data: localData(db, Math.floor(now / 1000)),
    pickFile: async (extensions) => {
      picked.push(extensions);
      return opts.file === undefined ? path.join(FIXTURES, 'statement-card-uk.csv') : opts.file;
    },
    decode: async (format, bytes) => {
      decoded.push([format, bytes.byteLength]);
      return opts.decoded ?? { ok: true, document: { format: 'sheets', sheets: [] } };
    },
    importRunning: () => opts.running ?? false,
    randomId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`,
    nowMs: () => now,
    timeZone: () => 'Europe/Kyiv',
    log: (m) => logs.push(m),
  });
  return { svc, logs, picked, decoded, advance: (ms: number) => (now += ms) };
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
    const { svc, logs, picked, decoded } = harness();
    const opened = await svc.open(conn);
    expect(opened).toEqual({
      opened: true,
      statementId: expect.any(String),
      statements: [{ currencyCode: 980, rows: 5, from: '2026-10-03', to: '2026-10-07', type: null, cardTail: null, accounts: [] }],
    });
    // The dialog: every extension Monobank's readers name (once each); text never goes to the decoder.
    expect(picked).toEqual([['csv', 'xlsx']]);
    expect(decoded).toEqual([]);
    if (!opened.opened) throw new Error('not opened');
    const target = [{ kind: 'new', type: 'black' }] as const;
    expect(await svc.compare(opened.statementId, [null])).toEqual({
      ok: true,
      comparisons: [{ match: { kind: 'new' }, rows: 5, matched: 0, amountDiffers: 0, added: 5, missingInFile: 0, gap: null, blocked: null }],
    });
    expect(await svc.commit(opened.statementId, [...target])).toEqual({ written: true, added: 5 });
    // Written once: the kept statement is gone.
    expect(await svc.commit(opened.statementId, [...target])).toEqual({ written: false, reason: 'expired' });

    const again = await svc.open(conn);
    if (!again.opened) throw new Error('not opened');
    const [first] = again.statements;
    expect(first?.accounts.map((a) => [a.kind, a.type, a.currencyCode])).toEqual([['card', 'black', 980]]);
    expect(await svc.compare(again.statementId, [{ kind: 'account', accountId: first!.accounts[0]!.id }])).toMatchObject({
      ok: true,
      comparisons: [{ match: { kind: 'account', accountId: first!.accounts[0]!.id }, matched: 5, added: 0 }],
    });

    const text = JSON.stringify([opened, again, logs]);
    for (const leak of [FIXTURES, 'statement-card-uk', 'Тест Маркет', 'Від:']) expect(text).not.toContain(leak);
    expect(logs).toEqual(['[statement] opened 1 accounts, 5 rows', '[statement] added 5', '[statement] opened 1 accounts, 5 rows']);
  });

  it('the kind comes from the bytes: a renamed CSV reads as text, a zip goes to the decoder whatever its name', async () => {
    const conn = await fileConnection();
    const renamed = path.join(dir, 'statement.pdf');
    fs.copyFileSync(path.join(FIXTURES, 'statement-card-uk.csv'), renamed);
    const h = harness({ file: renamed });
    expect(await h.svc.open(conn)).toMatchObject({ opened: true, statements: [{ rows: 5 }] });
    expect(h.decoded).toEqual([]);

    const zip = path.join(dir, 'statement.csv');
    fs.writeFileSync(zip, Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]));
    const z = harness({ file: zip });
    expect(await z.svc.open(conn)).toMatchObject({ opened: true });
    expect(z.decoded).toEqual([['xlsx', 7]]);
  });

  it('a file of two accounts: one row each, no IBAN; written together; a re-upload finds the card by its number', async () => {
    const conn = await fileConnection();
    const sheet = path.join(dir, 'two.xlsx');
    fs.writeFileSync(sheet, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const { svc, logs } = harness({ file: sheet });
    const opened = await svc.open(conn);
    if (!opened.opened) throw new Error('not opened');
    expect(opened.statements.map((s) => [s.currencyCode, s.rows, s.type, s.cardTail])).toEqual([
      [980, 5, null, null],
      [840, 2, 'white', '1111'],
    ]);
    expect(JSON.stringify(opened)).not.toContain(IBAN);
    expect(logs).toEqual(['[statement] opened 2 accounts, 7 rows']);

    // One target per account: a list of another length is refused before anything runs.
    await expect(svc.compare(opened.statementId, [null])).rejects.toThrow(/One target per account/);
    await expect(svc.commit(opened.statementId, [{ kind: 'new', type: null }])).rejects.toThrow(/One target per account/);
    expect(await svc.commit(opened.statementId, [{ kind: 'new', type: 'black' }, { kind: 'new', type: null }])).toEqual({ written: true, added: 7 });

    const again = await svc.open(conn);
    if (!again.opened) throw new Error('not opened');
    expect(again.statements.map((s) => s.accounts.length)).toEqual([1, 1]);
    const c = await svc.compare(again.statementId, [null, null]);
    if (!c.ok) throw new Error('expired');
    // The first states nothing to match by: offered as new (the screen offers its only card); the second by its card.
    expect(c.comparisons.map((x) => x.match)).toEqual([{ kind: 'new' }, { kind: 'account', accountId: again.statements[1]!.accounts[0]!.id }]);
    expect(c.comparisons[1]).toMatchObject({ matched: 2, added: 0 });
  });

  it("another bank's statement is refused, nothing is kept", async () => {
    const conn = await fileConnection();
    const other = path.join(dir, 'other.csv');
    fs.writeFileSync(other, 'OTHERBANK,statement\n');
    expect(await harness({ file: other }).svc.open(conn)).toEqual({ opened: false, reason: 'problem', problem: 'other-bank', row: null });
  });

  it("the decoder's refusals as the screen's codes; the log gets the code only", async () => {
    const conn = await fileConnection();
    const pdf = path.join(dir, 'statement.pdf');
    fs.writeFileSync(pdf, '%PDF-1.7\n');
    const cases: Array<[DecodeOutcome, string]> = [
      [{ ok: false, code: 'encrypted' }, 'encrypted'],
      [{ ok: false, code: 'unreadable' }, 'unreadable'],
      [{ ok: false, code: 'crashed' }, 'unreadable'],
      [{ ok: false, code: 'bad-reply' }, 'unreadable'],
      [{ ok: false, code: 'too-many-pages' }, 'over-limits'],
      [{ ok: false, code: 'too-large' }, 'over-limits'],
      [{ ok: false, code: 'timeout' }, 'timeout'],
      [{ ok: true, document: { format: 'pdf', pages: [] } }, 'unknown-format'],
    ];
    for (const [decoded, problem] of cases) {
      const h = harness({ file: pdf, decoded });
      expect(await h.svc.open(conn)).toEqual({ opened: false, reason: 'problem', problem, row: null });
      expect(h.decoded).toEqual([['pdf', 9]]);
      expect(h.logs).toEqual([`[statement] ${problem}`]);
    }
  });

  it('a token connection: compared, not written', async () => {
    const { integrations } = services(db, dir);
    const r = await integrations.addConnection({ participant: { label: 'Вигадана Особа' }, provider: 'monobank', token: TOKEN, remember: true });
    if (!r.added) throw new Error('not added');
    const { svc } = harness();
    const opened = await svc.open(r.connectionId);
    if (!opened.opened) throw new Error('not opened');
    expect(await svc.compare(opened.statementId, [{ kind: 'new', type: null }])).toMatchObject({ ok: true, comparisons: [{ blocked: 'token' }] });
    expect(await svc.commit(opened.statementId, [{ kind: 'new', type: null }])).toEqual({ written: false, reason: 'token' });
  });

  it('a cancelled dialog, a refused file, a file past the limit, bytes that are not UTF-8', async () => {
    const conn = await fileConnection();
    expect(await harness({ file: null }).svc.open(conn)).toEqual({ opened: false, reason: 'cancelled' });
    expect(await harness({ file: path.join(FIXTURES, 'statement-card.csv') }).svc.open(conn)).toEqual({ opened: false, reason: 'problem', problem: 'language', row: null });
    expect(await harness({ file: path.join(FIXTURES, 'statement-fop.csv') }).svc.open(conn)).toEqual({ opened: false, reason: 'problem', problem: 'unsupported-kind', row: null });

    const big = path.join(dir, 'big.csv');
    fs.writeFileSync(big, '');
    fs.truncateSync(big, STATEMENT_MAX_BYTES + 1);
    const tooBig = harness({ file: big });
    expect(await tooBig.svc.open(conn)).toEqual({ opened: false, reason: 'problem', problem: 'too-large', row: null });
    expect(tooBig.decoded).toEqual([]);

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
    const target = [{ kind: 'new', type: null }] as const;
    expect(await svc.compare(first.statementId, [...target])).toEqual({ ok: false, reason: 'expired' });
    advance(STATEMENT_KEEP_MS + 1);
    expect(await svc.compare(second.statementId, [...target])).toEqual({ ok: false, reason: 'expired' });

    const third = await svc.open(conn);
    if (!third.opened) throw new Error('not opened');
    svc.forget();
    expect(await svc.commit(third.statementId, [...target])).toEqual({ written: false, reason: 'expired' });
    await expect(svc.open(999)).rejects.toThrow(/No such connection/);
  });

  it('refused while an import runs; the statement stays for a retry', async () => {
    const conn = await fileConnection();
    const running = { value: true };
    const svc = new StatementsService({
      data: localData(db, 0),
      pickFile: async () => path.join(FIXTURES, 'statement-card-uk.csv'),
      decode: async () => ({ ok: false, code: 'unreadable' }),
      importRunning: () => running.value,
      randomId: () => '00000000-0000-4000-8000-000000000001',
      nowMs: () => 0,
      timeZone: () => 'Europe/Kyiv',
      log: () => undefined,
    });
    const opened = await svc.open(conn);
    if (!opened.opened) throw new Error('not opened');
    expect(await svc.commit(opened.statementId, [{ kind: 'new', type: null }])).toEqual({ written: false, reason: 'import-running' });
    running.value = false;
    expect(await svc.commit(opened.statementId, [{ kind: 'new', type: null }])).toEqual({ written: true, added: 5 });
  });
});
