// The token never goes back to the renderer, into logs or to disk in plain text; without a secure store it stays in memory.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerIpc, type IpcEventLike } from '../src/main/ipc.ts';
import { TOKEN_FILE, TokenError, TokenStore, type SafeStorageLike } from '../src/main/token.ts';

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

const store = (ss: SafeStorageLike, platform: NodeJS.Platform = 'darwin') => new TokenStore({ safeStorage: ss, platform, userDataDir: dir });
const file = () => path.join(dir, TOKEN_FILE);

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
    expect(fs.readdirSync(dir)).toEqual([]);
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
    expect(fs.readdirSync(dir)).toEqual([]);
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
      const s = store(ss);
      handlers.clear();
      registerIpc(
        { handle: (ch, fn) => void handlers.set(ch, fn) },
        { setToken: (t, r) => s.set(t, r), clearToken: () => s.clear(), hasToken: () => s.status() },
        // The same log line as src/main/index.ts: the error's name only.
        { trusted: () => true, onError: (m, err) => logs.push(`[ipc] ${m}: ${err instanceof Error ? err.name : 'error'}`) },
      );
    };
    const ev = { sender: {}, senderFrame: { url: 'app://renderer/', parent: null } };
    const outputs: unknown[] = [];
    const call = async (ch: string, ...a: unknown[]) => outputs.push(await handlers.get(ch)!(ev, ...a).catch((e: Error) => ({ error: e.message, name: e.name })));

    wire(fakeSafeStorage());
    await call('balance:setToken', CANARY, true);
    await call('balance:hasToken');
    await call('balance:setToken', CANARY, false);
    await call('balance:hasToken');
    await call('balance:setToken', `${CANARY} with space`, true); // rejected by zod
    await call('balance:clearToken');
    await call('balance:hasToken');
    wire(fakeSafeStorage({ failEncrypt: true }));
    await call('balance:setToken', CANARY, true); // safeStorage error message contains the token

    const text = JSON.stringify(outputs) + logs.join('\n');
    expect(text).not.toContain(CANARY);
    expect(text).not.toContain('CANARY');
    expect(outputs).toContainEqual({ stored: 'secure' });
    expect(outputs).toContainEqual({ error: 'Не удалось выполнить операцию', name: 'Error' });
    expect(logs).toEqual(['[ipc] setToken: Error']);
  });

  it('main: IPC handlers never call tokens.get(); the log line prints only err.name', () => {
    const code = fs.readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8');
    const ipcBlock = code.slice(code.indexOf('registerIpc(ipcMain'), code.indexOf('trusted:'));
    expect(ipcBlock).not.toMatch(/tokens\.get\(/);
    expect(code).toMatch(/onError: \(method, err\) => process\.stderr\.write\(`\[ipc\] \$\{method\}: \$\{err instanceof Error \? err\.name : 'error'\}\\n`\)/);
  });

  it('token.ts writes nowhere but its own file: no database, no logging', () => {
    const code = fs.readFileSync(new URL('../src/main/token.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code).not.toMatch(/@mono\/|db-libsql|console\.|process\.std(out|err)/);
    const imports = [...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(imports).toEqual(['node:fs', 'node:path', '../shared/api.ts']);
    expect(code).toMatch(/import type \{ TokenStatus \} from '\.\.\/shared\/api\.ts'/); // types only
  });
});
