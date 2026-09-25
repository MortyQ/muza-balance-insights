import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import type { Db } from '../src/db.ts';
import { exportAnalysis } from '../src/analysis/export.ts';
import { QUERIES_DIR, QueryRejected, readQueryFile, runQuery, splitStatements, validateQuery } from '../src/analysis/query.ts';
import { ANALYSIS_DB_PATH, ANALYSIS_SCHEMA } from '../src/analysis/schema.ts';
import { REPO_ROOT } from '../src/config.ts';
import { MCP_ROOT } from '../src/paths.ts';
import { maskDescription } from '@mono/core/masking';
import { memoryDb } from '@mono/core/test-helpers';

// Every value that must never reach analysis.sqlite.
const CANARY = {
  iban: 'UA00CANARYIBAN0000000001',
  pan: '537541******0042',
  jarTitle: 'CanaryJarTitle',
  counterName: 'Canary Counterpartovych',
  counterIban: 'UA00CANARYCOUNTERIBAN0002',
  counterEdrpou: '9988776655',
  comment: 'canary comment for coffee',
  receiptId: 'CANA-RYRE-CEIP-T001',
  rawJson: 'canary-raw-json-payload',
  personDescription: 'Canary Personenko',
  cardPanDescription: '516824******4802',
  fromDescription: 'Від: Canary Fromenko',
  treasuryDescription: 'ГУК Canary обл/18050400',
  newColumn: 'canary-value-in-a-column-added-later',
};

let tmpDir: string;
let source: Db;
let outPath: string;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-test-'));
  outPath = path.join(tmpDir, 'analysis.sqlite');
  source = await memoryDb();
  await seed(source);
});

afterEach(() => {
  source.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function seed(db: Db): Promise<void> {
  await db.execute({
    sql: `INSERT INTO accounts (id, kind, type, currency_code, iban, masked_pan, balance, credit_limit, updated_at)
          VALUES ('card1', 'card', 'black', 980, ?, ?, 100000, 0, 1)`,
    args: [CANARY.iban, JSON.stringify([CANARY.pan])],
  });
  await db.execute({
    sql: `INSERT INTO accounts (id, kind, currency_code, title, goal, balance, updated_at)
          VALUES ('jar1', 'jar', 980, ?, 500000, 2000, 1)`,
    args: [CANARY.jarTitle],
  });
  await db.execute(`INSERT INTO sync_state (account_id, oldest_synced_time, newest_synced_time, last_sync_at) VALUES ('jar1', 1, 2, 3)`);

  const tx = (id: string, account: string, time: number, amount: number, description: string, extra: Record<string, string | null> = {}) =>
    db.execute({
      sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount,
              currency_code, balance, comment, counter_name, counter_iban, counter_edrpou, receipt_id, raw_json, synced_at)
            VALUES (?, ?, ?, '2026-08-05', ?, 4829, 0, ?, ?, 980, 0, ?, ?, ?, ?, ?, ?, 1)`,
      args: [
        id, account, time, description, amount, amount,
        extra.comment ?? null, extra.counterName ?? null, extra.counterIban ?? null,
        extra.counterEdrpou ?? null, extra.receiptId ?? null,
        JSON.stringify({ id, payload: CANARY.rawJson }),
      ],
    });

  await tx('t1', 'card1', 100, -6366, CANARY.jarTitle);
  await tx('t2', 'jar1', 101, 6366, '10%');
  await tx('t3', 'card1', 200, -500, `Округлення балансу «${CANARY.jarTitle}»`);
  await tx('t4', 'card1', 300, -10000, CANARY.personDescription, {
    counterName: CANARY.counterName,
    counterIban: CANARY.counterIban,
    counterEdrpou: CANARY.counterEdrpou,
    comment: CANARY.comment,
    receiptId: CANARY.receiptId,
  });
  await tx('t5', 'card1', 400, -2000, CANARY.cardPanDescription);
  await tx('t6', 'card1', 500, 3000, CANARY.fromDescription, { counterName: '   ' });
  await tx('t7', 'card1', 600, -700, CANARY.treasuryDescription);
  await tx('t8', 'card1', 700, -45804, 'Щомісячний платіж ');
}

function fileContainsAnyCanary(file: string): string[] {
  const bytes = fs.readFileSync(file);
  return Object.values(CANARY).filter((c) => bytes.includes(Buffer.from(c, 'utf8')));
}

async function readOut<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const c = createClient({ url: `file:${outPath}` });
  try {
    return (await c.execute(sql)).rows as unknown as T[];
  } finally {
    c.close();
  }
}

describe('masking', () => {
  const jars = new Set([CANARY.jarTitle]);

  it('keeps known service strings and hides the jar title', () => {
    expect(maskDescription('10%', jars)).toEqual({ description: '10%', descClass: 'service' });
    expect(maskDescription('Щомісячний платіж ', jars)).toEqual({ description: 'Щомісячний платіж', descClass: 'service' });
    expect(maskDescription(CANARY.jarTitle, jars)).toEqual({ description: '[jar]', descClass: 'service' });
    expect(maskDescription('Регулярне поповнення «anything»', jars)).toEqual({
      description: 'Регулярне поповнення «[jar]»',
      descClass: 'service',
    });
  });

  it('turns everything else into [other] with a shape-only class', () => {
    expect(maskDescription(CANARY.personDescription, jars)).toEqual({ description: '[other]', descClass: 'other' });
    expect(maskDescription(CANARY.cardPanDescription, jars)).toEqual({ description: '[other]', descClass: 'card_pan' });
    expect(maskDescription(CANARY.fromDescription, jars)).toEqual({ description: '[other]', descClass: 'from_prefix' });
    expect(maskDescription(CANARY.treasuryDescription, jars)).toEqual({ description: '[other]', descClass: 'treasury' });
  });
});

describe('exportAnalysis', () => {
  it('control: the byte scan does find canaries in an unmasked copy of the source', async () => {
    await source.execute('ALTER TABLE transactions ADD COLUMN secret_note TEXT');
    await source.execute({ sql: 'UPDATE transactions SET secret_note = ?', args: [CANARY.newColumn] });
    const rawCopy = path.join(tmpDir, 'raw.sqlite');
    await source.execute({ sql: 'VACUUM INTO ?', args: [rawCopy] });
    expect(fileContainsAnyCanary(rawCopy).sort()).toEqual(Object.values(CANARY).sort());
  });

  it('writes no sensitive value anywhere in the output file (byte scan)', async () => {
    await exportAnalysis(source, outPath);
    expect(fileContainsAnyCanary(outPath)).toEqual([]);
  });

  it('output schema is exactly the whitelist', async () => {
    await exportAnalysis(source, outPath);
    const tables = await readOut<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(Object.keys(ANALYSIS_SCHEMA).sort());
    for (const [table, columns] of Object.entries(ANALYSIS_SCHEMA)) {
      const info = await readOut<{ name: string; type: string }>(`PRAGMA table_info(${table})`);
      expect(info.map((c) => ({ name: c.name, type: c.type })), table).toEqual(columns.map((c) => ({ ...c })));
    }
  });

  it('a column added to the source schema but not whitelisted is not exported', async () => {
    await source.execute('ALTER TABLE transactions ADD COLUMN secret_note TEXT');
    await source.execute({ sql: 'UPDATE transactions SET secret_note = ?', args: [CANARY.newColumn] });
    await exportAnalysis(source, outPath);
    const info = await readOut<{ name: string }>('PRAGMA table_info(transactions)');
    expect(info.map((c) => c.name)).toEqual(ANALYSIS_SCHEMA.transactions.map((c) => c.name));
    expect(fileContainsAnyCanary(outPath)).toEqual([]);
  });

  it('keeps service descriptions, masks the rest, derives has_counter and desc_class', async () => {
    const summary = await exportAnalysis(source, outPath);
    const rows = await readOut<{ id: string; description: string; desc_class: string; has_counter: number }>(
      'SELECT id, description, desc_class, has_counter FROM transactions ORDER BY id',
    );
    expect(rows.map((r) => [r.id, r.description, r.desc_class, Number(r.has_counter)])).toEqual([
      ['t1', '[jar]', 'service', 0],
      ['t2', '10%', 'service', 0],
      ['t3', 'Округлення балансу «[jar]»', 'service', 0],
      ['t4', '[other]', 'other', 1],
      ['t5', '[other]', 'card_pan', 0],
      ['t6', '[other]', 'from_prefix', 0], // blank counter_name is not a counterparty
      ['t7', '[other]', 'treasury', 0],
      ['t8', 'Щомісячний платіж', 'service', 0],
    ]);
    expect(summary.rows).toEqual({ accounts: 2, transactions: 8, sync_state: 1 });
    expect(summary.otherCount).toBe(4);
    const accounts = await readOut<{ id: string; title: string | null }>('SELECT id, title FROM accounts ORDER BY id');
    expect(accounts).toEqual([
      expect.objectContaining({ id: 'card1', title: null }),
      expect.objectContaining({ id: 'jar1', title: '[jar]' }),
    ]);
  });

  it('uses journal_mode = DELETE and overwrites the previous copy', async () => {
    await exportAnalysis(source, outPath);
    await source.execute(`DELETE FROM transactions WHERE id = 't8'`);
    const second = await exportAnalysis(source, outPath);
    expect(second.rows.transactions).toBe(7);
    const mode = await readOut<{ journal_mode: string }>('PRAGMA journal_mode');
    expect(mode[0]?.journal_mode).toBe('delete');
    expect(fs.readdirSync(tmpDir).sort()).toEqual(['analysis.sqlite']);
  });
});

describe('pnpm q', () => {
  beforeEach(async () => {
    await exportAnalysis(source, outPath);
  });

  it('reads only the fixed analysis file', () => {
    expect(ANALYSIS_DB_PATH).toBe(path.join(REPO_ROOT, 'analysis', 'analysis.sqlite'));
    expect(QUERIES_DIR).toBe(path.join(REPO_ROOT, 'analysis', 'queries'));
  });

  it('runs SELECT and WITH … SELECT, with comments and a trailing semicolon', () => {
    expect(runQuery('SELECT COUNT(*) AS n FROM transactions', outPath).rows).toEqual([[8]]);
    expect(runQuery('-- note\nWITH x AS (SELECT 1 AS v) SELECT v FROM x;', outPath).rows).toEqual([[1]]);
    expect(runQuery("SELECT ';' AS s /* ; */", outPath).rows).toEqual([[';']]);
    expect(runQuery('SELECT \'it\'\'s; fine\' AS s', outPath).rows).toEqual([["it's; fine"]]);
  });

  it.each([
    ["ATTACH 'x.sqlite' AS x"],
    ['DETACH x'],
    ['PRAGMA table_info(transactions)'],
    ["INSERT INTO accounts (id) VALUES ('x')"],
    ['UPDATE transactions SET amount = 0'],
    ['DELETE FROM transactions'],
    ['CREATE TABLE z (a)'],
    ['DROP TABLE transactions'],
    ['VACUUM'],
    ['SELECT 1; SELECT 2'],
    ['SELECT 1; DROP TABLE transactions'],
    ["SELECT 1; ATTACH 'x.sqlite' AS x"],
    ['SELECT 1 /* unterminated'],
    ["SELECT 'unterminated"],
    [''],
  ])('rejects %j', (sql) => {
    expect(() => runQuery(sql, outPath)).toThrow(QueryRejected);
    expect(runQuery('SELECT COUNT(*) FROM transactions', outPath).rows).toEqual([[8]]);
  });

  it('rejects WITH … DELETE (passes the keyword check, caught as a non-query)', () => {
    expect(() => runQuery('WITH x AS (SELECT 1) DELETE FROM transactions', outPath)).toThrow(QueryRejected);
    expect(runQuery('SELECT COUNT(*) FROM transactions', outPath).rows).toEqual([[8]]);
  });

  it('caps output at 500 rows and says so', () => {
    const r = runQuery(
      'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 600) SELECT x FROM c',
      outPath,
    );
    expect(r.rows).toHaveLength(500);
    expect(r.truncated).toBe(true);
  });

  it('fails clearly when the copy has not been exported yet', () => {
    expect(() => runQuery('SELECT 1', path.join(tmpDir, 'missing.sqlite'))).toThrow(/export:analysis/);
  });

  it('splits statements only outside strings and comments', () => {
    expect(splitStatements("SELECT 'a;b' ; -- x;\n")).toEqual(["SELECT 'a;b'"]);
    expect(splitStatements('SELECT [a;b] FROM "t;u"')).toHaveLength(1);
    expect(() => validateQuery('EXPLAIN SELECT 1')).toThrow(QueryRejected);
  });
});

describe('pnpm q: the SQL comes from a file in analysis/queries/', () => {
  let root: string;
  let dir: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'q-root-'));
    dir = path.join(root, 'analysis', 'queries');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ok.sql'), 'SELECT 1 AS one');
    fs.writeFileSync(path.join(root, 'outside.sql'), 'SELECT 2');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'SELECT 3');
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('reads a .sql file inside analysis/queries/, relative to the repo root or absolute', () => {
    expect(readQueryFile('analysis/queries/ok.sql', dir, root)).toBe('SELECT 1 AS one');
    expect(readQueryFile(path.join(dir, 'ok.sql'), dir, root)).toBe('SELECT 1 AS one');
  });

  it.each([
    ['outside.sql'],
    ['analysis/queries/../../outside.sql'],
    ['analysis/queries'],
    ['analysis/queries/notes.txt'],
    ['analysis/queries/missing.sql'],
    ['/etc/passwd'],
    ['data/monobank.db'],
  ])('rejects %j', (file) => {
    expect(() => readQueryFile(file, dir, root)).toThrow(QueryRejected);
  });

  it('rejects a symlink inside analysis/queries/ that points outside', () => {
    fs.symlinkSync(path.join(root, 'outside.sql'), path.join(dir, 'link.sql'));
    expect(() => readQueryFile('analysis/queries/link.sql', dir, root)).toThrow(/без ссылок наружу/);
  });

  it('rejects oversized files', () => {
    fs.writeFileSync(path.join(dir, 'big.sql'), `SELECT 1 ${'-'.repeat(70 * 1024)}`);
    expect(() => readQueryFile('analysis/queries/big.sql', dir, root)).toThrow(QueryRejected);
  });

  it('the CLI takes exactly one argument: a file, not SQL', () => {
    const code = fs.readFileSync(path.join(MCP_ROOT, 'scripts', 'q.ts'), 'utf8');
    expect(code).toMatch(/runQuery\(readQueryFile\(args\[0\]!\)\)/);
    expect(code).toMatch(/args\.length !== 1/);
  });
});
