// scripts/ensure-electron.mjs: binary missing → Electron's install.js runs; binary present → nothing happens;
// download failed → exit 1 with the command to run by hand. A fake electron package in a temp dir, no network.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INSTALL_HINT, platformPath } from '../scripts/electron-binary.mjs';
import { ensureElectron } from '../scripts/ensure-electron.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VERSION = '44.4.5';
const EXE = platformPath(process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux');
let dir: string;

/** What a successful install.js leaves behind (the files isInstalled() looks at). */
function writeBinary(d: string) {
  fs.mkdirSync(path.dirname(path.join(d, 'dist', EXE)), { recursive: true });
  fs.writeFileSync(path.join(d, 'dist', 'version'), `v${VERSION}`);
  fs.writeFileSync(path.join(d, 'dist', EXE), '');
  fs.writeFileSync(path.join(d, 'path.txt'), EXE);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-electron-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'electron', version: VERSION }));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('ensureElectron', () => {
  const run = (install: (d: string) => boolean) => {
    const out: string[] = [];
    const calls: string[] = [];
    const code = ensureElectron({
      dir,
      install: (d) => {
        calls.push(d);
        return install(d);
      },
      write: (s) => out.push(s),
    });
    return { code, calls, out: out.join('') };
  };

  it('binary present → installer not called, silent, exit 0', () => {
    writeBinary(dir);
    expect(run(() => true)).toEqual({ code: 0, calls: [], out: '' });
  });

  it('binary missing → installer called once, then the check passes, exit 0', () => {
    const r = run((d) => {
      writeBinary(d);
      return true;
    });
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([dir]);
    expect(r.out).toContain('Скачиваю');
  });

  it('download failed (no network) → exit 1 with the command to run by hand', () => {
    const r = run(() => false);
    expect(r.code).toBe(1);
    expect(r.calls).toHaveLength(1);
    expect(r.out).toContain('github.com');
    expect(r.out).toContain(INSTALL_HINT);
  });

  it('installer "succeeded" but the binary is still not there → exit 1, the reason is named', () => {
    const r = run(() => true);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/не скачан/);
    expect(r.out).toContain(INSTALL_HINT);
  });
});

describe('CLI (copies of the scripts next to node_modules/electron → the fake package)', () => {
  function cli(installJs: string) {
    fs.writeFileSync(path.join(dir, 'install.js'), installJs);
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-electron-cli-'));
    try {
      fs.mkdirSync(path.join(sandbox, 'node_modules'));
      fs.symlinkSync(dir, path.join(sandbox, 'node_modules', 'electron'));
      for (const f of ['ensure-electron.mjs', 'electron-binary.mjs']) fs.copyFileSync(path.join(ROOT, 'scripts', f), path.join(sandbox, f));
      return spawnSync(process.execPath, [path.join(sandbox, 'ensure-electron.mjs')], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  }
  // A stand-in for Electron's install.js: writes the binary files (success) or exits 1 (no network).
  const fakeInstall = (ok: boolean) =>
    ok
      ? `const fs=require('fs'),p=require('path');const exe=${JSON.stringify(EXE)};` +
        `fs.mkdirSync(p.dirname(p.join(__dirname,'dist',exe)),{recursive:true});fs.writeFileSync(p.join(__dirname,'dist','version'),'v${VERSION}');` +
        `fs.writeFileSync(p.join(__dirname,'dist',exe),'');fs.writeFileSync(p.join(__dirname,'path.txt'),exe);fs.writeFileSync(p.join(__dirname,'ran'),String(process.env.electron_config_cache));`
      : `require('fs').writeFileSync(require('path').join(__dirname,'ran'),'1');console.error('getaddrinfo ENOTFOUND github.com');process.exit(1);`;

  it('missing binary → runs the package install.js, exit 0', () => {
    const r = cli(fakeInstall(true));
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(dir, 'ran'))).toBe(true);
    // The download cache is inside the repo (next to the script copy here), never ~/Library/Caches/electron.
    expect(fs.readFileSync(path.join(dir, 'ran'), 'utf8')).toMatch(/[\\/]node_modules[\\/]\.cache[\\/]electron$/);
  });

  it('binary present → install.js is not run', () => {
    writeBinary(dir);
    const r = cli(fakeInstall(true));
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(dir, 'ran'))).toBe(false);
  });

  it('install.js fails → exit 1, stderr has the command', () => {
    const r = cli(fakeInstall(false));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(INSTALL_HINT);
  });
});
