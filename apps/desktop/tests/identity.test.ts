import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import os from 'node:os';
import { APP_NAME, DEV_APP_NAME, appIdentity, configureIdentity, restrictUserData } from '../src/main/identity.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_DATA = '/Users/test/Library/Application Support';

function fakeApp(isPackaged: boolean, ready = false) {
  const calls: Array<[string, ...string[]]> = [];
  return {
    calls,
    isPackaged,
    isReady: () => ready,
    getPath: (name: 'appData') => (name === 'appData' ? APP_DATA : '/unexpected'),
    setName: (n: string) => void calls.push(['setName', n]),
    setPath: (k: 'userData', v: string) => void calls.push(['setPath', k, v]),
  };
}

describe('app identity and userData', () => {
  it('names are exactly the ones closed in .claude/settings.json', () => {
    expect(APP_NAME).toBe('Balance Insights');
    expect(DEV_APP_NAME).toBe('Balance Insights Dev');
  });

  it('prod: «Balance Insights», dev: «Balance Insights Dev» — exact userData paths', () => {
    expect(appIdentity(true, APP_DATA)).toEqual({ name: 'Balance Insights', userData: `${APP_DATA}/Balance Insights` });
    expect(appIdentity(false, APP_DATA)).toEqual({ name: 'Balance Insights Dev', userData: `${APP_DATA}/Balance Insights Dev` });
  });

  it('configureIdentity sets the name and userData, in that order', () => {
    const app = fakeApp(false);
    configureIdentity(app);
    expect(app.calls).toEqual([
      ['setName', 'Balance Insights Dev'],
      ['setPath', 'userData', `${APP_DATA}/Balance Insights Dev`],
    ]);
  });

  it('refuses to run after ready (the default folder would already exist)', () => {
    expect(() => configureIdentity(fakeApp(true, true))).toThrow(/before app ready/);
  });

  it('main calls configureIdentity(app) at module top level, before app.whenReady()', () => {
    const code = fs.readFileSync(path.join(ROOT, 'src/main/index.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const configure = code.indexOf('configureIdentity(app)');
    const ready = code.indexOf('app.whenReady()');
    expect(configure).toBeGreaterThan(-1);
    expect(ready).toBeGreaterThan(configure);
    // Nothing reads or sets userData before the identity is configured.
    expect(code.slice(0, configure)).not.toMatch(/getPath|setPath|userData/);
  });

  it('package.json productName matches (the fallback name Electron would use)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.productName).toBe(APP_NAME);
  });
});

describe('restrictUserData', () => {
  const mode = (p: string) => fs.statSync(p).mode & 0o777;

  it.skipIf(process.platform === 'win32')('an existing 0755 folder becomes 0700; a missing one is created 0700', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'userdata-'));
    try {
      const existing = path.join(base, 'existing');
      fs.mkdirSync(existing, { mode: 0o755 });
      fs.chmodSync(existing, 0o755);
      await restrictUserData(existing);
      expect(mode(existing)).toBe(0o700);

      const missing = path.join(base, 'missing', 'Balance Insights');
      await restrictUserData(missing);
      expect(mode(missing)).toBe(0o700);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  it('Windows: nothing is touched (no POSIX modes)', async () => {
    const dir = path.join(os.tmpdir(), 'userdata-never-created-on-win32');
    await restrictUserData(dir, 'win32');
    expect(fs.existsSync(dir)).toBe(false);
  });
});
