// The update flow with fakes for the network, electron-updater and the file system. The rule under test: nothing is
// installed or handed to the user unless the signed manifest verified and the file matched it.
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { UpdateView } from '../src/shared/update.ts';
import { APP_ID } from '../src/main/update/manifest.ts';
import { MANIFEST_URL, SIGNATURE_URL, Updater, fileUrl, type ElectronUpdaterLike, type UpdaterDeps } from '../src/main/update/updater.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const PUBLIC = String(publicKey.export({ type: 'spki', format: 'pem' }));
const INSTALLER = Buffer.from('the new installer');
const sha512 = (b: Buffer) => createHash('sha512').update(b).digest('base64');

function manifest(version = '0.3.0', key = privateKey) {
  const files = ['mac-arm64.dmg', 'win-x64.exe', 'linux-x64.AppImage'].map((f) => {
    const [os_, rest] = f.split('-') as [string, string];
    return { os: os_, arch: rest.split('.')[0]!, name: `Balance-Insights-${version}-${f}`, size: INSTALLER.length, sha512: sha512(INSTALLER) };
  });
  const bytes = Buffer.from(JSON.stringify({ app: APP_ID, version, released: '2026-10-01', files }));
  return { bytes, sig: sign(null, bytes, key).toString('base64') };
}

function setup(o: {
  platform?: NodeJS.Platform;
  appImage?: string;
  release?: { bytes: Buffer; sig: string } | 'offline';
  feedVersion?: string;
  downloaded?: Buffer;
  importRunning?: boolean;
  checksEnabled?: boolean;
} = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'updater-'));
  const downloadsDir = path.join(tmp, 'Downloads');
  fs.mkdirSync(downloadsDir);
  const release = o.release ?? manifest();
  const sent: UpdateView[] = [];
  const log: string[] = [];
  const fetched: string[] = [];
  const quit: Array<[boolean | undefined, boolean | undefined]> = [];
  const saved: boolean[] = [];
  const eu: ElectronUpdaterLike & { feed?: unknown; handlers: Map<string, (p: { percent: number }) => void> } = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowPrerelease: true,
    allowDowngrade: true,
    disableDifferentialDownload: false,
    handlers: new Map(),
    setFeedURL(f) {
      this.feed = f;
    },
    async checkForUpdates() {
      return { updateInfo: { version: o.feedVersion ?? '0.3.0' } };
    },
    async downloadUpdate() {
      this.handlers.get('download-progress')?.({ percent: 55.4 });
      const file = path.join(tmp, 'eu-cache', 'installer.exe');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, o.downloaded ?? INSTALLER);
      return [file];
    },
    quitAndInstall(silent, forceRun) {
      quit.push([silent, forceRun]);
    },
    on(event, cb) {
      this.handlers.set(event, cb);
      return this;
    },
  };
  let euCreated = 0;
  const deps: UpdaterDeps = {
    currentVersion: '0.2.0',
    platform: o.platform ?? 'win32',
    arch: o.platform === 'darwin' ? 'arm64' : 'x64',
    isPackaged: true,
    appImage: o.appImage,
    publicKeyPem: PUBLIC,
    checksEnabled: o.checksEnabled ?? true,
    saveChecksEnabled: async (e) => void saved.push(e),
    downloadsDir,
    updatesDir: path.join(tmp, 'updates'),
    fetchBytes: async (url) => {
      fetched.push(url);
      if (release === 'offline') throw new TypeError('net::ERR_INTERNET_DISCONNECTED');
      return url === MANIFEST_URL ? release.bytes : Buffer.from(release.sig);
    },
    download: async (url, dest, _max, onProgress) => {
      fetched.push(url);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      onProgress(100);
      fs.writeFileSync(dest, o.downloaded ?? INSTALLER);
    },
    electronUpdater: () => {
      euCreated += 1;
      return eu;
    },
    importRunning: () => o.importRunning ?? false,
    moveToFreeName: async (from, dir, name) => {
      fs.renameSync(from, path.join(dir, name));
      return name;
    },
    remove: async (f) => fs.rmSync(f, { force: true }),
    send: (v) => void sent.push(v),
    log: (m) => void log.push(m),
    now: () => new Date('2026-10-02T10:00:00Z'),
  };
  return { u: new Updater(deps), eu, sent, log, fetched, quit, saved, downloadsDir, euCreated: () => euCreated };
}

describe('Updater — Windows / Linux AppImage (auto)', () => {
  it('check → download in the background → verified → ready; installs on quit only from then on', async () => {
    const t = setup();
    const v = await t.u.check(false);
    expect(v.state).toEqual({ phase: 'ready', version: '0.3.0' });
    expect(t.sent.map((s) => s.state.phase)).toEqual(['checking', 'available', 'downloading', 'downloading', 'ready']);
    expect(t.eu).toMatchObject({ autoDownload: false, allowPrerelease: false, allowDowngrade: false, disableDifferentialDownload: true, autoInstallOnAppQuit: true });
    expect(t.eu.feed).toEqual({ provider: 'github', owner: 'MortyQ', repo: 'muza-balance-insights' });
    expect(t.fetched).toEqual([MANIFEST_URL, SIGNATURE_URL]);
  });

  it('a downloaded file that differs from the manifest is deleted and never installed', async () => {
    const t = setup({ downloaded: Buffer.from('a tampered installer') });
    const v = await t.u.check(false);
    expect(v.state.phase).toBe('error');
    expect(t.eu.autoInstallOnAppQuit).toBe(false);
    expect(t.u.install()).toEqual({ started: false, reason: 'not-ready' });
    expect(t.quit).toEqual([]);
  });

  it('latest.yml of another version than the signed manifest → refused before downloading', async () => {
    const t = setup({ feedVersion: '0.4.0' });
    expect((await t.u.check(false)).state.phase).toBe('error');
    expect(t.eu.autoInstallOnAppQuit).toBe(false);
  });

  it('install: silent, relaunch after; refused while an import runs', async () => {
    const busy = setup({ importRunning: true });
    await busy.u.check(false);
    expect(busy.u.install()).toEqual({ started: false, reason: 'import-running' });
    const t = setup();
    await t.u.check(false);
    expect(t.u.install()).toEqual({ started: true });
    expect(t.quit).toEqual([[true, true]]);
  });

  it('Linux: an AppImage updates by itself; without $APPIMAGE it is the manual path', async () => {
    expect((await setup({ platform: 'linux', appImage: '/home/u/Balance.AppImage' }).u.check(false)).state.phase).toBe('ready');
    const manual = setup({ platform: 'linux' });
    expect((await manual.u.check(false)).state).toEqual({ phase: 'available', version: '0.3.0', mode: 'manual' });
    expect(manual.euCreated()).toBe(0);
  });
});

describe('Updater — macOS (manual)', () => {
  it('check → available; download → verified → saved to Downloads; electron-updater never created', async () => {
    const t = setup({ platform: 'darwin' });
    expect((await t.u.check(false)).state).toEqual({ phase: 'available', version: '0.3.0', mode: 'manual' });
    const v = await t.u.download();
    expect(v.state).toEqual({ phase: 'saved', version: '0.3.0', fileName: 'Balance-Insights-0.3.0-mac-arm64.dmg' });
    expect(fs.readFileSync(path.join(t.downloadsDir, 'Balance-Insights-0.3.0-mac-arm64.dmg'))).toEqual(INSTALLER);
    expect(t.fetched.at(-1)).toBe(fileUrl('0.3.0', 'Balance-Insights-0.3.0-mac-arm64.dmg'));
    expect(t.euCreated()).toBe(0);
    expect(t.u.install()).toEqual({ started: false, reason: 'not-ready' });
  });

  it('a .dmg that differs from the manifest never reaches Downloads', async () => {
    const t = setup({ platform: 'darwin', downloaded: Buffer.from('a tampered image!!') });
    await t.u.check(false);
    expect((await t.u.download()).state.phase).toBe('error');
    expect(fs.readdirSync(t.downloadsDir)).toEqual([]);
  });
});

describe('Updater — what is refused, and when it stays quiet', () => {
  it('a manifest signed with another key → error, nothing downloaded', async () => {
    const t = setup({ release: manifest('0.3.0', generateKeyPairSync('ed25519').privateKey) });
    expect((await t.u.check(false)).state.phase).toBe('error');
    expect(t.euCreated()).toBe(0);
  });

  it('the same version → up to date', async () => {
    const t = setup({ release: manifest('0.2.0') });
    expect((await t.u.check(true)).state).toEqual({ phase: 'up-to-date', checkedAt: '2026-10-02T10:00:00.000Z' });
  });

  it('offline: a background check keeps the screen as it was, a check the user asked for says so', async () => {
    const bg = setup({ release: 'offline' });
    expect((await bg.u.check(false)).state).toEqual({ phase: 'idle' });
    const asked = setup({ release: 'offline' });
    expect((await asked.u.check(true)).state.phase).toBe('error');
    expect(asked.log.join('\n')).not.toMatch(/https?:/);
  });

  it('checks off: the scheduler does nothing, a check the user asked for still runs; the switch is saved', async () => {
    const t = setup({ checksEnabled: false });
    await t.u.check(false);
    expect(t.fetched).toEqual([]);
    await t.u.check(true);
    expect(t.fetched).toEqual([MANIFEST_URL, SIGNATURE_URL]);
    const v = await t.u.setChecks(true);
    expect(v.checksEnabled).toBe(true);
    expect(t.saved).toEqual([true]);
  });

  it('a dev build checks nothing', async () => {
    const t = setup();
    const dev = new Updater({ ...(t.u as unknown as { d: UpdaterDeps }).d, isPackaged: false });
    expect((await dev.check(true)).supported).toBe(false);
    expect(t.fetched).toEqual([]);
  });
});
