// Electron ≥ 42 has no postinstall; dev/build check the binary inline and point to the explicit install step.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INSTALL_HINT, missingReason, platformPath } from '../scripts/electron-binary.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let dir: string;

function fakeElectron(opts: { version?: string; distVersion?: string | null; pathTxt?: string | null; exe?: boolean } = {}) {
  const version = opts.version ?? '44.4.5';
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'electron', version }));
  fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
  if (opts.distVersion !== null) fs.writeFileSync(path.join(dir, 'dist', 'version'), `v${opts.distVersion ?? version}`);
  const p = platformPath('darwin');
  if (opts.pathTxt !== null) fs.writeFileSync(path.join(dir, 'path.txt'), opts.pathTxt ?? p);
  if (opts.exe !== false) {
    fs.mkdirSync(path.dirname(path.join(dir, 'dist', p)), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dist', p), '');
  }
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-pkg-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('missingReason (mirrors isInstalled() of Electron install.js)', () => {
  it('installed → null', () => {
    fakeElectron();
    expect(missingReason(dir, { platform: 'darwin' })).toBeNull();
  });

  it.each([
    ['no dist/version (clean install)', { distVersion: null }, /не скачан/],
    ['dist of another version', { distVersion: '43.0.0' }, /43\.0\.0.*44\.4\.5/],
    ['no path.txt', { pathTxt: null }, /path\.txt/],
    ['path.txt for another platform', { pathTxt: 'electron.exe' }, /electron\.exe/],
    ['executable missing', { exe: false }, /исполняемого/],
  ] as const)('%s → reason', (_, opts, re) => {
    fakeElectron(opts);
    expect(missingReason(dir, { platform: 'darwin' })).toMatch(re);
  });

  it('platform paths match install.js', () => {
    expect(platformPath('darwin')).toBe('Electron.app/Contents/MacOS/Electron');
    expect(platformPath('linux')).toBe('electron');
    expect(platformPath('win32')).toBe('electron.exe');
  });
});

describe('scripts', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  it('dev and build check the binary inline, first (pnpm does not run pre-scripts)', () => {
    expect(pkg.scripts.dev).toBe('node scripts/electron-binary.mjs --check && electron-vite dev');
    expect(pkg.scripts.build).toBe('node scripts/electron-binary.mjs --check && electron-vite build');    expect(pkg.scripts['binary:install']).toBe('node scripts/electron-binary.mjs --install');
    expect(Object.keys(pkg.scripts).filter((k) => /^(pre|post)/.test(k))).toEqual([]);
  });

  it('the hint names the real script', () => {
    expect(INSTALL_HINT).toBe('pnpm --filter @mono/desktop run binary:install');
    expect(pkg.scripts[INSTALL_HINT.split(' ').at(-1)!]).toBeDefined();
  });

  it('--check on a missing binary: exit 1 with the hint (CLI, against a fake package via a copy of the script)', () => {
    fakeElectron({ distVersion: null });
    // Resolve `electron` to the fake package: put the script next to a node_modules/electron symlink.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-cli-'));
    try {
      fs.mkdirSync(path.join(sandbox, 'node_modules'));
      fs.symlinkSync(dir, path.join(sandbox, 'node_modules', 'electron'));
      fs.copyFileSync(path.join(ROOT, 'scripts', 'electron-binary.mjs'), path.join(sandbox, 'electron-binary.mjs'));
      const r = spawnSync(process.execPath, [path.join(sandbox, 'electron-binary.mjs'), '--check'], { encoding: 'utf8' });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('не скачан');
      expect(r.stderr).toContain(INSTALL_HINT);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('allowBuilds no longer mentions electron (no postinstall to allow)', () => {
    const ws = fs.readFileSync(path.join(ROOT, '..', '..', 'pnpm-workspace.yaml'), 'utf8');
    expect(ws).not.toMatch(/^\s*electron:/m);
  });
});
