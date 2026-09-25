// The updater's network: one session, the one electron-updater uses, guarded so that only the `github` trusted
// service passes — for its requests and ours, and for every redirect hop. Plus the «Проверять обновления» file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PREFS_FILE, readPrefs, writePrefs } from '../src/main/update/prefs.ts';
import { UPDATE_PARTITION, downloadTo, guardUpdateSession, type UpdateSessionLike } from '../src/main/update/session.ts';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

function fakeSession(body: Uint8Array[] = [], headers: Record<string, string> = {}) {
  let guard: ((d: { url: string }, cb: (r: { cancel: boolean }) => void) => void) | null = null;
  let permission: ((wc: unknown, p: string, cb: (g: boolean) => void) => void) | null = null;
  const ses: UpdateSessionLike = {
    webRequest: { onBeforeRequest: (h) => void (guard = h) },
    setPermissionRequestHandler: (h) => void (permission = h),
    fetch: async () =>
      new Response(new ReadableStream({ start: (c) => (body.forEach((b) => c.enqueue(b)), c.close()) }), { status: 200, headers }),
  };
  const decide = (url: string) => {
    let cancel: boolean | null = null;
    guard!({ url }, (r) => (cancel = r.cancel));
    return cancel;
  };
  const askPermission = () => {
    let granted: boolean | null = null;
    permission!(null, 'notifications', (g) => (granted = g));
    return granted;
  };
  return { ses, decide, askPermission };
}

describe('update session guard', () => {
  it.each([
    ['https://github.com/MortyQ/muza-balance-insights/releases.atom', false],
    ['https://github.com/MortyQ/muza-balance-insights/releases/latest/download/update.json', false],
    ['https://release-assets.githubusercontent.com/github-production-release-asset/1/2?sig=x', false],
    ['https://api.monobank.ua/personal/client-info', true],
    ['https://objects.githubusercontent.com/x', true],
    ['http://github.com/x', true],
    ['https://github.com.evil.example/x', true],
    ['https://evil.example/x', true],
  ])('%s → cancel %s', (url, cancel) => {
    const f = fakeSession();
    guardUpdateSession(f.ses);
    expect(f.decide(url)).toBe(cancel);
  });

  it('no permission is ever granted in that session', () => {
    const f = fakeSession();
    guardUpdateSession(f.ses);
    expect(f.askPermission()).toBe(false);
  });

  it('the partition is electron-updater’s own (NET_SESSION_NAME), so the guard covers its requests too', () => {
    const src = fs.readFileSync(fileURLToPath(new URL('../node_modules/electron-updater/out/electronHttpExecutor.js', import.meta.url)), 'utf8');
    expect(src).toContain(`exports.NET_SESSION_NAME = "${UPDATE_PARTITION}";`);
  });

  it('a download never grows past the size the manifest gave', async () => {
    const f = fakeSession([new Uint8Array(600), new Uint8Array(600)]);
    const got: number[] = [];
    const write = async (_d: string, chunks: AsyncIterable<Uint8Array>) => {
      for await (const c of chunks) got.push(c.length);
    };
    await expect(downloadTo(f.ses, 'https://github.com/x', '/tmp/x', 1000, () => {}, write)).rejects.toThrow(/larger/);
    expect(got).toEqual([600]);
  });
});

describe('updater network lives in one place', () => {
  function listTs(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? listTs(p) : /\.(ts|vue)$/.test(p) ? [p] : [];
    });
  }
  const files = listTs(SRC).map((f) => path.relative(SRC, f).split(path.sep).join('/'));

  it('only update/electron.ts creates a session partition or imports electron-updater, and it guards the session first', () => {
    expect(files.filter((f) => /fromPartition\(/.test(read(f)))).toEqual(['main/update/electron.ts']);
    expect(files.filter((f) => /from ['"]electron-updater['"]/.test(read(f)))).toEqual(['main/update/electron.ts']);
    const src = read('main/update/electron.ts');
    const created = src.indexOf('fromPartition(UPDATE_PARTITION');
    expect(created).toBeGreaterThan(-1);
    expect(src.indexOf('guardUpdateSession(ses', created)).toBeGreaterThan(created);
    expect(src.indexOf('guardUpdateSession(ses')).toBeLessThan(src.indexOf('new Updater('));
  });

  it('session fetches only in update/session.ts', () => {
    expect(files.filter((f) => /\bses\.fetch\(|session\.fetch\(/.test(read(f)))).toEqual(['main/update/session.ts']);
  });
});

describe('«Проверять обновления» preference', () => {
  it('on by default; a broken file reads as the default; writes round-trip', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prefs-'));
    expect(readPrefs(dir)).toEqual({ updateChecks: true });
    fs.writeFileSync(path.join(dir, PREFS_FILE), '{broken');
    expect(readPrefs(dir)).toEqual({ updateChecks: true });
    await writePrefs(dir, { updateChecks: false });
    expect(readPrefs(dir)).toEqual({ updateChecks: false });
  });
});
