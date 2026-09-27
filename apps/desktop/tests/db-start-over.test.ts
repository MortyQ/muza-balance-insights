// «Начать заново» with fakes around it (the database itself: DbAccess.reset in db-access.test.ts).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DbState } from '../src/main/db/access.ts';
import { startOver, type StartOverDeps } from '../src/main/db/start-over.ts';
import { JOB_FILE } from '../src/main/importer.ts';

const TOKEN_A = 'uTestTokenAAAAAAAAAAAAAAAAAAAAAA';
const TOKEN_B = 'uTestTokenBBBBBBBBBBBBBBBBBBBBBB';

let dir: string;
beforeEach(() => void (dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startover-'))));
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function deps(o: { ready?: boolean; confirm?: boolean; tokens?: Record<number, string | null | Error>; after?: DbState } = {}) {
  const calls: string[] = [];
  const added: unknown[] = [];
  const logs: string[] = [];
  const tokens = o.tokens ?? {};
  const d: StartOverDeps = {
    access: {
      isReady: () => o.ready ?? false,
      reset: async () => (calls.push('reset'), o.after ?? { kind: 'ready', encrypted: true, notice: null }),
    },
    confirm: async () => (calls.push('confirm'), o.confirm ?? true),
    tokens: {
      saved: async () => Object.keys(tokens).map(Number),
      get: async (id) => {
        calls.push(`get:${id}`);
        const t = tokens[id];
        if (t instanceof Error) throw t;
        return t ?? null;
      },
      clearAll: async () => void calls.push('clearAll'),
    },
    importer: { stop: async () => void calls.push('stop') },
    data: { close: async () => void calls.push('close') },
    people: {
      addConnection: async (input) => (calls.push('add'), added.push(input), { added: true }),
    },
    userDataDir: dir,
    log: (m) => void logs.push(m),
  };
  return { d, calls, added, logs };
}

describe('startOver', () => {
  it('a ready database: refused before anything is asked or touched', async () => {
    const { d, calls } = deps({ ready: true });
    expect(await startOver(d)).toEqual({ done: false, reason: 'not-needed' });
    expect(calls).toEqual([]);
  });

  it('cancelled: nothing is deleted', async () => {
    fs.writeFileSync(path.join(dir, JOB_FILE), '{}');
    const { d, calls } = deps({ confirm: false, tokens: { 1: TOKEN_A } });
    expect(await startOver(d)).toEqual({ done: false, reason: 'cancelled' });
    expect(calls).toEqual(['confirm']);
    expect(fs.existsSync(path.join(dir, JOB_FILE))).toBe(true);
  });

  it('confirmed: tokens read before they are cleared, the database reset, readable tokens become connections', async () => {
    fs.writeFileSync(path.join(dir, JOB_FILE), '{}');
    const { d, calls, added, logs } = deps({ tokens: { 1: TOKEN_A, 2: null, 3: 'not a token', 4: new Error('keychain'), 5: TOKEN_B, 6: TOKEN_A } });
    expect(await startOver(d)).toEqual({ done: true, restoredConnections: 2 });
    expect(calls).toEqual(['confirm', 'stop', 'close', 'get:1', 'get:2', 'get:3', 'get:4', 'get:5', 'get:6', 'clearAll', 'reset', 'add', 'add']);
    expect(added).toEqual([
      { participant: { fromBank: true }, provider: 'monobank', token: TOKEN_A, remember: true },
      { participant: { fromBank: true }, provider: 'monobank', token: TOKEN_B, remember: true },
    ]);
    expect(fs.existsSync(path.join(dir, JOB_FILE))).toBe(false);
    expect(JSON.stringify(logs)).not.toContain(TOKEN_A);
  });

  it('the new database is not ready: tokens are not restored, it says so', async () => {
    const { d, calls, logs } = deps({ tokens: { 1: TOKEN_A }, after: { kind: 'key-unavailable' } });
    expect(await startOver(d)).toEqual({ done: true, restoredConnections: 0 });
    expect(calls).not.toContain('add');
    expect(logs).toEqual(['start over: state=key-unavailable, tokens not restored']);
  });

  it('a connection that fails to be added is skipped, the error name logged, never the token', async () => {
    const { d, logs } = deps({ tokens: { 1: TOKEN_A, 2: TOKEN_B } });
    let n = 0;
    d.people.addConnection = async () => {
      if (n++ === 0) throw new TypeError(`bad ${TOKEN_A}`);
      return { added: true };
    };
    expect(await startOver(d)).toEqual({ done: true, restoredConnections: 1 });
    expect(logs).toContain('start over: connection not restored: TypeError');
    expect(JSON.stringify(logs)).not.toContain(TOKEN_A);
  });
});
