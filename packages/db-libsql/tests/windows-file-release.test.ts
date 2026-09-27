// Diagnostics, not a gate: when does a closed libsql database stop holding its file? On Windows an open file cannot be
// renamed or deleted (EBUSY); macOS and Linux allow both, so there every probe passes and the report only proves the
// script runs. Each scenario uses its own folder and prints one `DIAG {json}` line per probe, then a summary table
// (also appended to the GitHub step summary when GITHUB_STEP_SUMMARY is set). The test itself never fails on a probe:
// the encryption tests are the gate, this file is what explains them.
//
// Hypotheses:
//  H1 the native connection closes on close(), but prepared statements keep it alive until they are garbage-collected
//     (@libsql/client prepares a statement for every execute and never finalizes it; libsql-js has no Statement.close);
//  H2 Windows only releases the file a moment later (a delay helps, gc does not matter);
//  H3 the client/pool keeps a connection that close() does not reach (raw libsql releases, the client does not);
//  H4 WAL or encryption make a difference (-wal/-shm, the cipher);
//  H5 a separate process that exits releases everything (the fallback: file work in a child process).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';
import { openLibsql } from '../src/index.ts';

const KEY = 'c0ffee'.padEnd(64, '0');
const OTHER_KEY = 'beef'.padEnd(64, '1');

type RawStatement = { get(...args: unknown[]): unknown; run(...args: unknown[]): unknown };
type RawDatabase = { prepare(sql: string): RawStatement; exec(sql: string): void; close(): void; open: boolean };
type RawDatabaseCtor = new (file: string, opts?: { encryptionKey?: string }) => RawDatabase;

// libsql is a dependency of @libsql/client, not of this package: resolve it from there.
const req = createRequire(import.meta.url);
const clientEntry = req.resolve('@libsql/client');
const libsqlEntry = createRequire(clientEntry).resolve('libsql');
const Database = createRequire(clientEntry)('libsql') as RawDatabaseCtor;

function versionOf(entry: string): string {
  for (let dir = path.dirname(entry); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const p = path.join(dir, 'package.json');
    if (fs.existsSync(p)) {
      const pkg = JSON.parse(fs.readFileSync(p, 'utf8')) as { name?: string; version?: string };
      if (pkg.name) return `${pkg.name}@${pkg.version}`;
    }
  }
  return 'unknown';
}

function nativeVersion(): string {
  try {
    const dir = path.dirname(libsqlEntry);
    const native = fs.readdirSync(path.join(dir, '..', '@libsql')).filter((n) => n.startsWith(`${process.platform}-`));
    return native.map((n) => versionOf(path.join(dir, '..', '@libsql', n, 'package.json'))).join(', ') || 'none found';
  } catch (e) {
    return `unreadable: ${(e as Error).message}`;
  }
}

let gcFn: (() => void) | null = null;
try {
  v8.setFlagsFromString('--expose-gc');
  gcFn = vm.runInNewContext('gc') as () => void;
} catch {
  gcFn = null;
}
async function collect(): Promise<boolean> {
  if (!gcFn) return false;
  gcFn();
  // Native finalizers may run after the collection: give them a turn, then collect again.
  await new Promise((r) => setImmediate(r));
  gcFn();
  await new Promise((r) => setTimeout(r, 50));
  return true;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Probe = {
  scenario: string;
  step: string;
  file: string;
  exists: boolean;
  /** rename away and back: true = nothing holds the file. */
  movable: boolean | null;
  code: string | null;
  ms: number;
};
const probes: Probe[] = [];
const notes: string[] = [];
const FILES = ['', '-wal', '-shm', '-journal'];

function log(line: object) {
  process.stdout.write(`DIAG ${JSON.stringify(line)}\n`);
}

/** Is each of the database's files free? Rename is used, not unlink: it tells the same and loses nothing. */
function probe(scenario: string, step: string, db: string, t0: number) {
  for (const suffix of FILES) {
    const f = `${db}${suffix}`;
    const exists = fs.existsSync(f);
    let movable: boolean | null = null;
    let code: string | null = null;
    if (exists) {
      try {
        fs.renameSync(f, `${f}.probe`);
        fs.renameSync(`${f}.probe`, f);
        movable = true;
      } catch (e) {
        movable = false;
        code = (e as NodeJS.ErrnoException).code ?? String(e);
      }
    }
    const p: Probe = { scenario, step, file: path.basename(f), exists, movable, code, ms: Date.now() - t0 };
    probes.push(p);
    if (exists) log(p);
  }
}

function held(scenario: string, step: string): boolean {
  return probes.some((p) => p.scenario === scenario && p.step === step && p.movable === false);
}

async function scenario(name: string, run: (file: string, t0: number) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `dbdiag-${name}-`));
  const file = path.join(dir, 'test.db');
  const t0 = Date.now();
  try {
    await run(file, t0);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    log({ scenario: name, error: err.name, code: err.code ?? null, message: err.message });
    notes.push(`${name}: threw ${err.name} ${err.code ?? ''} ${err.message}`);
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch (e) {
    log({ scenario: name, cleanup: (e as NodeJS.ErrnoException).code ?? String(e) });
  }
}

/** Probe right after close, after short waits, then after a forced gc — which of them frees the file. */
async function afterClose(name: string, file: string, t0: number) {
  probe(name, 'closed', file, t0);
  for (const ms of [100, 1000]) {
    if (!held(name, 'closed')) break;
    await sleep(ms);
    probe(name, `wait+${ms}ms`, file, t0);
  }
  const gcRan = await collect();
  probe(name, gcRan ? 'after-gc' : 'after-gc(unavailable)', file, t0);
}

describe('diagnostics: when a closed libsql database releases its file', () => {
  it('runs every scenario and reports (never fails on a probe)', { timeout: 120_000 }, async () => {
    const env = {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      client: versionOf(clientEntry),
      libsql: versionOf(libsqlEntry),
      native: nativeVersion(),
      gc: gcFn !== null,
      pool: process.env.VITEST_POOL_ID ?? null,
    };
    log({ env });

    await scenario('A-fs-only', async (file, t0) => {
      fs.writeFileSync(file, 'x');
      probe('A-fs-only', 'written', file, t0);
    });

    await scenario('B-raw-open-close', async (file, t0) => {
      const db = new Database(file);
      db.close();
      log({ scenario: 'B-raw-open-close', openAfterClose: db.open });
      await afterClose('B-raw-open-close', file, t0);
    });

    await scenario('C-raw-exec-only', async (file, t0) => {
      const db = new Database(file);
      db.exec('CREATE TABLE t (x); INSERT INTO t VALUES (1);');
      db.close();
      await afterClose('C-raw-exec-only', file, t0);
    });

    await scenario('D-raw-prepared', async (file, t0) => {
      const db = new Database(file);
      db.exec('CREATE TABLE t (x)');
      let stmt: RawStatement | null = db.prepare('INSERT INTO t VALUES (?)');
      stmt.run(1);
      db.close();
      probe('D-raw-prepared', 'closed-stmt-alive', file, t0);
      stmt = null;
      void stmt;
      await afterClose('D-raw-prepared', file, t0);
    });

    await scenario('E-raw-prepared-wal', async (file, t0) => {
      const db = new Database(file);
      db.exec('PRAGMA journal_mode = WAL; CREATE TABLE t (x);');
      db.prepare('INSERT INTO t VALUES (?)').run(1);
      db.prepare('SELECT x FROM t').get();
      db.close();
      await afterClose('E-raw-prepared-wal', file, t0);
    });

    await scenario('F-raw-prepared-key', async (file, t0) => {
      const db = new Database(file, { encryptionKey: KEY });
      db.exec('CREATE TABLE t (x)');
      db.prepare('INSERT INTO t VALUES (?)').run(1);
      db.close();
      await afterClose('F-raw-prepared-key', file, t0);
    });

    await scenario('G-client', async (file, t0) => {
      const client = createClient({ url: `file:${file}`, concurrency: 1 });
      await client.execute('CREATE TABLE t (x)');
      await client.execute({ sql: 'INSERT INTO t VALUES (?)', args: [1] });
      await client.execute('SELECT x FROM t');
      client.close();
      await afterClose('G-client', file, t0);
    });

    await scenario('H-adapter-key-wal', async (file, t0) => {
      const db = await openLibsql(`file:${file}`, { encryptionKey: KEY });
      await db.execute('CREATE TABLE t (x)');
      await db.execute({ sql: 'INSERT INTO t VALUES (?)', args: [1] });
      db.close();
      await afterClose('H-adapter-key-wal', file, t0);
    });

    await scenario('I-adapter-wrong-key', async (file, t0) => {
      (await openLibsql(`file:${file}`, { encryptionKey: KEY })).close();
      await collect();
      probe('I-adapter-wrong-key', 'seeded', file, t0);
      const failed = await openLibsql(`file:${file}`, { encryptionKey: OTHER_KEY }).then(
        () => 'opened (unexpected)',
        (e: Error) => e.message.slice(0, 80),
      );
      log({ scenario: 'I-adapter-wrong-key', open: failed });
      await afterClose('I-adapter-wrong-key', file, t0);
    });

    await scenario('J-child-process', async (file, t0) => {
      const script = [
        `const Database = require(${JSON.stringify(libsqlEntry)});`,
        `const db = new Database(${JSON.stringify(file)});`,
        `db.exec('PRAGMA journal_mode = WAL; CREATE TABLE t (x);');`,
        `db.prepare('INSERT INTO t VALUES (?)').run(1);`,
        `db.close();`,
      ].join('\n');
      const r = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 30_000 });
      log({ scenario: 'J-child-process', status: r.status, stderr: r.stderr.slice(0, 300) });
      probe('J-child-process', 'child-exited', file, t0);
    });

    const rows = probes.filter((p) => p.exists);
    const table = [
      '| scenario | step | file | movable | code | ms |',
      '|---|---|---|---|---|---|',
      ...rows.map((p) => `| ${p.scenario} | ${p.step} | ${p.file} | ${p.movable} | ${p.code ?? ''} | ${p.ms} |`),
    ].join('\n');
    const report = [
      `### db-libsql file release (${env.platform} ${env.arch}, node ${env.node})`,
      '',
      `client ${env.client} · libsql ${env.libsql} · native ${env.native} · forced gc available: ${env.gc}`,
      '',
      table,
      ...(notes.length > 0 ? ['', 'Errors:', ...notes.map((n) => `- ${n}`)] : []),
      '',
    ].join('\n');
    process.stdout.write(`\nDIAG-REPORT-BEGIN\n${report}\nDIAG-REPORT-END\n`);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);

    // Only that the report was produced: every scenario left at least one probe or an error.
    expect(probes.some((p) => p.scenario === 'A-fs-only' && p.movable === true)).toBe(true);
  });
});
