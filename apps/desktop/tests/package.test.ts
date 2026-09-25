// Security Checklist #19 (fuses) and the shape of the packaged app. The config part always runs; the binary part runs
// on the unpacked app in dist/ of this OS: `package:dir` locally (macOS), `package:mac|win|linux` in CI.
// PACKAGE_CHECK=1 fails if that app is missing, so a green run there really checked a binary. Nothing here launches
// the app. The same checks run on the app inside each .dmg: tests/dmg.test.ts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  APP_ID,
  LINUX_EXECUTABLE,
  PRODUCT,
  binaryArchs,
  built,
  expectAsarContents,
  expectAsarOnly,
  expectBundleId,
  expectFuses,
  expectOwnIcon,
  expectValidSignature,
  libsqlNative,
  SLOW_CHECK_MS,
  unpackedNatives,
  type Platform,
} from './helpers/app-checks.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, 'electron-builder.json'), 'utf8')) as Record<string, unknown>;
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> } & Record<string, unknown>;

describe('release metadata', () => {
  it('author, MIT license and the repository in package.json; LICENSE at the repo root', () => {
    expect(pkg).toMatchObject({
      author: 'MortyQ',
      license: 'MIT',
      homepage: 'https://github.com/MortyQ/muza-balance-insights',
      repository: { url: 'https://github.com/MortyQ/muza-balance-insights', directory: 'apps/desktop' },
    });
    expect(fs.readFileSync(path.join(root, '..', '..', 'LICENSE'), 'utf8')).toMatch(/^MIT License\n\nCopyright \(c\) 2026 MortyQ\n/);
  });
});

describe('electron-builder config', () => {
  it('fuses exactly as agreed, plus an ad-hoc re-sign (flipping fuses breaks the arm64 signature)', () => {
    expect(config.electronFuses).toEqual({
      runAsNode: false,
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false,
      enableEmbeddedAsarIntegrityValidation: true,
      onlyLoadAppFromAsar: true,
      grantFileProtocolExtraPrivileges: false,
      enableCookieEncryption: false,
      loadBrowserProcessSpecificV8Snapshot: false,
      resetAdHocDarwinSignature: true,
    });
  });

  it('only the build output goes in, as an asar; native modules unpacked; no rebuild, no signing identity', () => {
    expect(config.productName).toBe(PRODUCT);
    // Frozen after the first release (CLAUDE.md): bundle id, updates, Windows install identity.
    expect(config.appId).toBe(APP_ID);
    expect(config.files).toEqual(['out/**', 'package.json']);
    expect(config.asar).toBe(true);
    expect(config.asarUnpack).toEqual(['**/*.node']);
    expect(config.npmRebuild).toBe(false);
    expect(config.mac).toMatchObject({ identity: null });
    // The Electron download cache inside the repo: ~/Library/Caches/electron is closed to the agent (same folder as …/Electron).
    expect(config.electronDownload).toEqual({ cache: 'node_modules/.cache/electron' });
  });

  it('targets: a .dmg per Mac architecture, an nsis .exe, an AppImage — one artifact name scheme', () => {
    expect(config.mac).toMatchObject({ target: [{ target: 'dmg', arch: ['arm64', 'x64'] }], artifactName: 'Balance-Insights-${version}-mac-${arch}.${ext}' });
    expect(config.dmg).toEqual({ sign: false, writeUpdateInfo: false });
    expect(config.win).toEqual({ target: [{ target: 'nsis', arch: ['x64'] }], artifactName: 'Balance-Insights-${version}-win-${arch}.${ext}' });
    // Per-user install, no admin prompt; uninstall keeps the data folder (deleting it is «Delete all data» in the app).
    // No .blockmap: the release does not carry them (electron-updater downloads the whole installer).
    expect(config.nsis).toEqual({ oneClick: true, perMachine: false, deleteAppDataOnUninstall: false, differentialPackage: false });
    expect(config.linux).toEqual({
      target: [{ target: 'AppImage', arch: ['x64'] }],
      executableName: LINUX_EXECUTABLE,
      category: 'Finance',
      artifactName: 'Balance-Insights-${version}-linux-${arch}.${ext}',
    });
  });

  it('update feed: the GitHub releases of this repository, a draft only — the config only makes latest*.yml, nothing publishes', () => {
    expect(config.publish).toEqual({ provider: 'github', owner: 'MortyQ', repo: 'muza-balance-insights', releaseType: 'draft' });
  });

  it('scripts: installers never publish by themselves (the release job does); the local Electron only for --dir', () => {
    // node_modules/electron/dist is the host's Electron: in the shared config it would end up in the other-arch .dmg too.
    expect(config).not.toHaveProperty('electronDist');
    expect(pkg.scripts['package:dir']).toBe(
      'pnpm run build && electron-builder --dir --config electron-builder.json -c.electronDist=node_modules/electron/dist -c.mac.target=dir',
    );
    for (const os of ['mac', 'win', 'linux'])
      expect(pkg.scripts[`package:${os}`]).toBe(
        `pnpm run build && electron-builder --${os} --publish never --config electron-builder.json && node scripts/checksums.mjs dist`,
      );
  });
});

describe('app icon (build/, picked up by electron-builder)', () => {
  const build = path.join(root, 'build');

  it('mac .icns up to 1024 px, windows .ico up to 256 px, linux .png at least 512 px, square', () => {
    const icns = fs.readFileSync(path.join(build, 'icon.icns'));
    expect(icns.subarray(0, 4).toString('latin1')).toBe('icns');
    // ic10 = 1024×1024 (512@2x): the Retina Dock / Finder size.
    expect(icns.includes(Buffer.from('ic10', 'latin1'))).toBe(true);
    const ico = fs.readFileSync(path.join(build, 'icon.ico'));
    expect(ico.readUInt16LE(2)).toBe(1);
    const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + 16 * i] || 256);
    expect(sizes).toContain(256);
    const png = fs.readFileSync(path.join(build, 'icon.png'));
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    expect(w).toBe(h);
    expect(w).toBeGreaterThanOrEqual(512);
  });
});

// ---------- the built app of this OS ----------

const platform = process.platform as Platform;
const arch = process.arch;
/** electron-builder's unpacked output folder per OS and arch. */
const unpackedDir: Record<Platform, string> = {
  darwin: arch === 'arm64' ? 'mac-arm64' : 'mac',
  win32: arch === 'arm64' ? 'win-arm64-unpacked' : 'win-unpacked',
  linux: arch === 'arm64' ? 'linux-arm64-unpacked' : 'linux-unpacked',
};
const known = platform in unpackedDir;
const app = known ? built(path.join(root, 'dist', unpackedDir[platform]), platform) : null;
const present = app !== null && fs.existsSync(app.binary);
if (process.env.PACKAGE_CHECK === '1' && !present) throw new Error(`PACKAGE_CHECK=1 but no built app at ${app?.binary ?? platform}: package it first`);

describe.skipIf(!present)(`packaged app (dist/, ${platform}-${arch})`, () => {
  it('fuses in the binary are exactly the agreed table', async () => {
    await expectFuses(app!);
  });

  it('code only from app.asar: no side app/ folder (macOS: the asar hash is in Info.plist)', () => {
    expectAsarOnly(app!);
  });

  it('the asar holds the build output and runtime deps only — no sources, maps, tests, workspace packages or data', () => {
    expectAsarContents(app!);
  });

  it('the native libsql module for this OS and arch is unpacked next to the asar (it cannot load from inside)', () => {
    expect(unpackedNatives(app!).some((f) => f.includes(libsqlNative(platform, arch)))).toBe(true);
  });

  it.runIf(platform === 'darwin')('macOS: frozen bundle id, own icon, host-arch executable, valid ad-hoc signature', () => {
    expectBundleId(app!);
    expectOwnIcon(app!, path.join(root, 'build', 'icon.icns'));
    expect(binaryArchs(app!)).toEqual([arch === 'arm64' ? 'arm64' : 'x86_64']);
    // Flipping fuses breaks the arm64 signature; without the ad-hoc re-sign macOS kills the app.
    expectValidSignature(app!);
  }, SLOW_CHECK_MS);
});
