// Tokens (one per connection) never go back to the renderer, into logs or to disk in plain text; without a secure
// store they stay in memory. The single token of older versions moves to its connection unread.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerIpc, type IpcEventLike } from '../src/main/ipc.ts';
import { LEGACY_TOKEN_FILE, TOKENS_DIR, TokenError, TokenVault, type SafeStorageLike } from '../src/main/token.ts';

const CANARY = 'uCANARY-TOKEN-must-never-leak-7f3e9b2a';
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Reversible, and the ciphertext never contains the plain text (reversed + base64). */
function fakeSafeStorage(opts: { available?: boolean; backend?: string; key?: string; failEncrypt?: boolean } = {}): SafeStorageLike {
  const key = opts.key ?? 'k1';
  return {
    isAsyncEncryptionAvailable: async () => opts.available ?? true,
    encryptStringAsync: async (s) => {
      if (opts.failEncrypt) throw new Error(`encrypt failed for ${s}`); // a hostile message that includes the input
      return Buffer.from(`${key}:${Buffer.from([...s].reverse().join('')).toString('base64')}`);
    },
    decryptStringAsync: async (b) => {
      const [k, body] = b.toString().split(':');
      if (k !== key) throw new Error('Error while decrypting the ciphertext provided to safeStorage.decryptString.');
      return { result: [...Buffer.from(body!, 'base64').toString()].reverse().join(''), shouldReEncrypt: false };
    },
    ...(opts.backend ? { getSelectedStorageBackend: () => opts.backend! } : {}),
  };
}

const vault = (ss: SafeStorageLike, platform: NodeJS.Platform = 'darwin') => new TokenVault({ safeStorage: ss, platform, userDataDir: dir });
/** The old single-token API over connection 1: the guarantees below are per connection. */
const store = (ss: SafeStorageLike, platform: NodeJS.Platform = 'darwin') => {
  const v = vault(ss, platform);
  return {
    set: (t: string, remember: boolean) => v.set(1, 'monobank', t, remember),
    status: () => v.status(1),
    clear: () => v.clear(1),
    get: () => v.get(1),
  };
};
const file = (id = 1) => path.join(dir, TOKENS_DIR, `${id}.bin`);
const files = () => (fs.existsSync(path.join(dir, TOKENS_DIR)) ? fs.readdirSync(path.join(dir, TOKENS_DIR)) : []);

describe('secure store available (Keychain / DPAPI / libsecret)', () => {
  it('remember → encrypted file (0600, no plain text), survives a restart', async () => {
    const ss = fakeSafeStorage();
    const s = store(ss);
    expect(await s.set(CANARY, true)).toEqual({ stored: 'secure' });
    expect(fs.statSync(file()).mode & 0o777).toBe(0o600);
    const bytes = fs.readFileSync(file());
    expect(bytes.includes(Buffer.from(CANARY))).toBe(false);
    expect(fs.existsSync(`${file()}.tmp`)).toBe(false);
    expect(await s.status()).toEqual({ present: true, stored: 'secure', secureStorage: true, needsReentry: false });

    const afterRestart = store(ss);
    expect(await afterRestart.status()).toMatchObject({ present: true, stored: 'secure' });
    expect(await afterRestart.get()).toBe(CANARY);
  });

  it('not remembered → memory only, and an older saved token is removed', async () => {
    const s = store(fakeSafeStorage());
    await s.set(CANARY, true);
    expect(await s.set(`${CANARY}-2`, false)).toEqual({ stored: 'memory' });
    expect(fs.existsSync(file())).toBe(false);
    expect(await s.status()).toEqual({ present: true, stored: 'memory', secureStorage: true, needsReentry: false });
    expect(await s.get()).toBe(`${CANARY}-2`);
    expect(await store(fakeSafeStorage()).get()).toBeNull(); // gone after a restart
  });

  it('clear → nothing in memory, nothing on disk', async () => {
    const s = store(fakeSafeStorage());
    await s.set(CANARY, true);
    await s.clear();
    expect(files()).toEqual([]);
    expect(await s.get()).toBeNull();
    expect(await s.status()).toMatchObject({ present: false, stored: null });
  });

  it('an undecryptable blob (rebuilt unsigned app, other machine) is removed and the UI is told to ask again', async () => {
    await store(fakeSafeStorage({ key: 'old' })).set(CANARY, true);
    const s = store(fakeSafeStorage({ key: 'new' }));
    expect(await s.get()).toBeNull();
    expect(fs.existsSync(file())).toBe(false);
    expect(await s.status()).toMatchObject({ present: false, needsReentry: true });
    await s.set(CANARY, true);
    expect((await s.status()).needsReentry).toBe(false);
  });
});

describe('no secure store → memory only, and the UI knows', () => {
  it.each([
    ['encryption unavailable (macOS/Windows)', fakeSafeStorage({ available: false }), 'darwin'],
    ['Linux basic_text (hard-coded key)', fakeSafeStorage({ backend: 'basic_text' }), 'linux'],
    ['Linux unknown backend', fakeSafeStorage({ backend: 'unknown' }), 'linux'],
    ['Linux, backend not reported', fakeSafeStorage(), 'linux'],
  ] as const)('%s', async (_, ss, platform) => {
    const s = store(ss, platform);
    expect(await s.set(CANARY, true)).toEqual({ stored: 'memory' });
    expect(files()).toEqual([]);
    expect(await s.status()).toEqual({ present: true, stored: 'memory', secureStorage: false, needsReentry: false });
    expect(await s.get()).toBe(CANARY);
  });

  it('Linux with a real secret store (gnome_libsecret, kwallet6) is secure', async () => {
    for (const backend of ['gnome_libsecret', 'kwallet6']) {
      const s = store(fakeSafeStorage({ backend }), 'linux');
      expect(await s.set(CANARY, true)).toEqual({ stored: 'secure' });
      await s.clear();
    }
  });
});

describe('the token never leaves main', () => {
  it('a malformed token is refused without echoing it', async () => {
    const s = store(fakeSafeStorage());
    const err = await s.set('has spaces inside it 123456', true).catch((e: Error) => e);
    expect(err).toBeInstanceOf(TokenError);
    expect((err as Error).message).not.toContain('has spaces');
  });

  it('through IPC: no reply, no error and no log line contains the token — even when safeStorage throws with it', async () => {
    const handlers = new Map<string, (e: IpcEventLike, ...a: unknown[]) => Promise<unknown>>();
    const logs: string[] = [];
    const wire = (ss: SafeStorageLike) => {
      const v = vault(ss);
      handlers.clear();
      registerIpc(
        { handle: (ch, fn) => void handlers.set(ch, fn) },
        // What reaches the vault from the renderer: a connection's new token (src/main/people.ts → TokenVault.set).
        { setConnectionToken: (id, t, r) => v.set(id, 'monobank', t, r) },
        // The same log line as src/main/index.ts: the error's name only.
        { trusted: () => true, onError: (m, err) => logs.push(`[ipc] ${m}: ${err instanceof Error ? err.name : 'error'}`) },
      );
    };
    const ev = { sender: {}, senderFrame: { url: 'app://renderer/', parent: null } };
    const outputs: unknown[] = [];
    const call = async (ch: string, ...a: unknown[]) => outputs.push(await handlers.get(ch)!(ev, ...a).catch((e: Error) => ({ error: e.message, name: e.name })));

    wire(fakeSafeStorage());
    await call('balance:setConnectionToken', 1, CANARY, true);
    await call('balance:setConnectionToken', 2, CANARY, false);
    await call('balance:setConnectionToken', 1, `${CANARY} with space`, true); // rejected by zod
    wire(fakeSafeStorage({ failEncrypt: true }));
    await call('balance:setConnectionToken', 1, CANARY, true); // safeStorage error message contains the token

    const text = JSON.stringify(outputs) + logs.join('\n');
    expect(text).not.toContain(CANARY);
    expect(text).not.toContain('CANARY');
    expect(outputs).toContainEqual({ stored: 'secure' });
    expect(outputs).toContainEqual({ error: 'Не удалось выполнить операцию', name: 'Error' });
    expect(logs).toEqual(['[ipc] setConnectionToken: Error']);
  });

  it('main: IPC handlers never read a token (vault.get); the log line prints only err.name', () => {
    const code = fs.readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8');
    const ipcBlock = code.slice(code.indexOf('registerIpc(ipcMain'), code.indexOf('trusted:'));
    expect(ipcBlock).toMatch(/listPeople: \(\) => people\.list\(\)/); // control: this is the handler block
    expect(ipcBlock).not.toMatch(/(tokens|vault)\.get\(/);
    expect(code).toMatch(/onError: \(method, err\) => process\.stderr\.write\(`\[ipc\] \$\{method\}: \$\{err instanceof Error \? err\.name : 'error'\}\\n`\)/);
  });

  it('token.ts writes nowhere but its own file: no database, no logging', () => {
    const code = fs.readFileSync(new URL('../src/main/token.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code).not.toMatch(/@mono\/|db-libsql|console\.|process\.std(out|err)/);
    const imports = [...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(imports).toEqual(['node:fs', 'node:path', '../shared/api.ts', '../net/providers.ts']);
    expect(code).toMatch(/import type \{ TokenStatus \} from '\.\.\/shared\/api\.ts'/); // types only
    // The providers table: credential shapes only — no network, database or logging either.
    const providers = fs.readFileSync(new URL('../src/net/providers.ts', import.meta.url), 'utf8');
    expect([...providers.matchAll(/^import (type )?.* from '([^']+)'/gm)].map((m) => [m[1] ?? '', m[2]])).toEqual([
      ['type ', '@mono/core/providers/types'],
    ]);
  });
});

describe('several connections', () => {
  it("each connection has its own token, file and status; clearing one leaves the other", async () => {
    const ss = fakeSafeStorage();
    const v = vault(ss);
    await v.set(1, 'monobank', CANARY, true);
    await v.set(2, 'monobank', `${CANARY}-her`, false);
    expect(files()).toEqual(['1.bin']);
    expect(await v.saved()).toEqual([1]);
    expect(await v.status(2)).toMatchObject({ present: true, stored: 'memory' });
    expect(await v.status(3)).toMatchObject({ present: false, stored: null });
    await v.clear(1);
    expect(await v.get(1)).toBeNull();
    expect(await v.get(2)).toBe(`${CANARY}-her`);

    await v.set(1, 'monobank', CANARY, true);
    await v.set(4, 'monobank', CANARY, true);
    const restarted = vault(ss);
    expect(await restarted.saved()).toEqual([1, 4]);
    expect(await restarted.get(4)).toBe(CANARY);
    expect(await restarted.get(2)).toBeNull(); // memory only: gone after a restart
  });

  it('an undecryptable file asks again for that connection only', async () => {
    await vault(fakeSafeStorage({ key: 'old' })).set(1, 'monobank', CANARY, true);
    const v = vault(fakeSafeStorage({ key: 'new' }));
    await v.set(2, 'monobank', CANARY, true);
    expect(await v.get(1)).toBeNull();
    expect((await v.status(1)).needsReentry).toBe(true);
    expect(await v.status(2)).toMatchObject({ present: true, needsReentry: false });
  });

  it('clearAll: every token in memory and on disk, the legacy file too', async () => {
    const v = vault(fakeSafeStorage());
    await v.set(1, 'monobank', CANARY, true);
    await v.set(2, 'monobank', CANARY, false);
    fs.writeFileSync(path.join(dir, LEGACY_TOKEN_FILE), 'x');
    await v.clearAll();
    expect(fs.readdirSync(dir)).toEqual([]);
    expect(await v.get(1)).toBeNull();
    expect(await v.get(2)).toBeNull();
  });

  it('a connection id that is not a positive integer is refused (never a path)', async () => {
    const v = vault(fakeSafeStorage());
    for (const id of [0, -1, 1.5, Number.NaN]) await expect(v.set(id, 'monobank', CANARY, true)).rejects.toBeInstanceOf(TokenError);
    fs.mkdirSync(path.join(dir, TOKENS_DIR));
    fs.writeFileSync(path.join(dir, TOKENS_DIR, '../x.bin'), 'x');
    fs.writeFileSync(path.join(dir, TOKENS_DIR, '01.bin'), 'x');
    fs.writeFileSync(path.join(dir, TOKENS_DIR, '3.bin.tmp'), 'x');
    expect(await v.saved()).toEqual([]);
  });
});

describe('the token of an older version (token.bin)', () => {
  const legacy = () => path.join(dir, LEGACY_TOKEN_FILE);
  /** Written by the old app: the same safeStorage blob. */
  const oldApp = async (ss: SafeStorageLike) => fs.writeFileSync(legacy(), await ss.encryptStringAsync(CANARY), { mode: 0o600 });

  it('moves, unread, to its connection and keeps working after a restart', async () => {
    const ss = fakeSafeStorage();
    await oldApp(ss);
    fs.writeFileSync(`${legacy()}.tmp`, 'x');
    let decrypts = 0;
    const counting = { ...ss, decryptStringAsync: (b: Buffer) => (decrypts++, ss.decryptStringAsync(b)) };
    const v = vault(counting);
    expect(v.hasLegacy()).toBe(true);
    expect(await v.migrateLegacy(1)).toBe('moved');
    expect(decrypts).toBe(0);
    expect(fs.readdirSync(dir).sort()).toEqual([TOKENS_DIR]);
    expect(fs.statSync(file()).mode & 0o777).toBe(0o600);
    expect(await vault(ss).get(1)).toBe(CANARY);
    expect(await v.migrateLegacy(1)).toBe('none');
  });

  it('a token already saved for the connection wins; the old file is removed', async () => {
    const ss = fakeSafeStorage();
    const v = vault(ss);
    await v.set(1, 'monobank', `${CANARY}-new`, true);
    await oldApp(ss);
    expect(await v.migrateLegacy(1)).toBe('dropped');
    expect(v.hasLegacy()).toBe(false);
    expect(await vault(ss).get(1)).toBe(`${CANARY}-new`);
  });
});
