// releaseClosedFiles: after close() a database's files can be renamed and deleted — on Windows too, where a closed
// connection holds them until its prepared statements are collected (measured on the Windows CI runner: held after
// 1 s of waiting, free right after a forced gc). On macOS and Linux the files are free anyway; there it checks the call.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { canReleaseClosedFiles, openLibsql, releaseClosedFiles } from '../src/index.ts';

const KEY = 'c0ffee'.padEnd(64, '0');
let dir: string;
let file: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbrel-'));
  file = path.join(dir, 'test.db');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));

/** Every file of the database moves away and back: nothing holds it. */
function movable(): Record<string, boolean | string> {
  const out: Record<string, boolean | string> = {};
  for (const f of fs.readdirSync(dir)) {
    try {
      fs.renameSync(path.join(dir, f), path.join(dir, `${f}.moved`));
      fs.renameSync(path.join(dir, `${f}.moved`), path.join(dir, f));
      out[f] = true;
    } catch (e) {
      out[f] = (e as NodeJS.ErrnoException).code ?? 'error';
    }
  }
  return out;
}

describe('releaseClosedFiles', () => {
  it('forced gc is available in Node', async () => {
    expect(canReleaseClosedFiles()).toBe(true);
    expect(await releaseClosedFiles()).toBe(true);
  });

  it('an encrypted WAL database that ran statements: after close + release its files rename and delete', async () => {
    const db = await openLibsql(`file:${file}`, { encryptionKey: KEY });
    await db.execute('CREATE TABLE t (x)');
    for (let i = 0; i < 5; i++) await db.execute({ sql: 'INSERT INTO t VALUES (?)', args: [i] });
    await db.execute('SELECT x FROM t');
    db.close();
    await releaseClosedFiles();
    const state = movable();
    expect(Object.keys(state)).toContain('test.db');
    expect(Object.values(state).every((v) => v === true), JSON.stringify(state)).toBe(true);
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('after a failed open (wrong key) the file is released too', async () => {
    (await openLibsql(`file:${file}`, { encryptionKey: KEY })).close();
    await expect(openLibsql(`file:${file}`, { encryptionKey: 'beef'.padEnd(64, '1') })).rejects.toThrow(/NOTADB|not a database/i);
    await releaseClosedFiles();
    const state = movable();
    expect(Object.values(state).every((v) => v === true), JSON.stringify(state)).toBe(true);
  });
});
