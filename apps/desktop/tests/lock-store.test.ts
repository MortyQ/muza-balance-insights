import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOCK_FILE, readLock, removeLock, writeLock, type LockFile } from '../src/main/lock/store.ts';

const FILE: LockFile = {
  version: 1,
  kdf: { name: 'scrypt', N: 32768, r: 8, p: 1, salt: 'c2FsdHNhbHRzYWx0c2FsdA==' },
  hash: 'aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g=',
  touchId: true,
  triggers: { startup: true, idle: false, screenLock: true, sleep: true },
  failedAttempts: 2,
  nextAttemptAt: null,
};

let dir: string;
beforeEach(() => void (dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-'))));
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('lock.json', () => {
  it('no file → lock is off', () => {
    expect(readLock(dir)).toEqual({ kind: 'none' });
  });

  it('write → read gives the same record; the file is 0600 and no .tmp is left', async () => {
    await writeLock(dir, FILE);
    expect(readLock(dir)).toEqual({ kind: 'ok', file: FILE });
    if (process.platform !== 'win32') expect(fs.statSync(path.join(dir, LOCK_FILE)).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(dir)).toEqual([LOCK_FILE]);
  });

  it.each([
    ['not JSON', '{oops'],
    ['wrong version', JSON.stringify({ ...FILE, version: 2 })],
    ['missing hash', JSON.stringify({ ...FILE, hash: undefined })],
    ['extra field', JSON.stringify({ ...FILE, pin: '2580' })],
    ['weak KDF', JSON.stringify({ ...FILE, kdf: { ...FILE.kdf, N: 2 } })],
    ['KDF not pinned to pin.ts (N=65536)', JSON.stringify({ ...FILE, kdf: { ...FILE.kdf, N: 65536 } })],
    ['negative attempts', JSON.stringify({ ...FILE, failedAttempts: -1 })],
    ['hash of the wrong length', JSON.stringify({ ...FILE, hash: 'A' })],
    ['salt of the wrong length (15 bytes)', JSON.stringify({ ...FILE, kdf: { ...FILE.kdf, salt: Buffer.alloc(15, 1).toString('base64') } })],
  ])('%s → broken (stays locked)', (_, text) => {
    fs.writeFileSync(path.join(dir, LOCK_FILE), text);
    expect(readLock(dir)).toEqual({ kind: 'broken' });
  });

  it('a directory named lock.json → broken', () => {
    fs.mkdirSync(path.join(dir, LOCK_FILE));
    expect(readLock(dir)).toEqual({ kind: 'broken' });
  });

  it('removeLock deletes the file; a missing file is fine', async () => {
    await writeLock(dir, FILE);
    await removeLock(dir);
    await removeLock(dir);
    expect(readLock(dir)).toEqual({ kind: 'none' });
  });
});
