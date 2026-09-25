// The .dmg files of `package:mac`: each image is mounted read-only (hdiutil, no Finder window), and the app inside
// gets the same checks as dist/ in package.test.ts — plus the architecture: the x64 image must carry an x86_64
// Electron and the darwin-x64 libsql, not a copy of the host's arm64 ones. Images are mounted only under
// `test:dmg` (DMG_CHECK=1), which also fails when one is missing: not in `pnpm test` (hdiutil does not work in the
// agent's sandbox). The checksum part always runs. Nothing here launches the app.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SUMS_FILE, writeChecksums } from '../scripts/checksums.mjs';
import {
  PRODUCT,
  binaryArchs,
  built,
  expectAsarContents,
  expectAsarOnly,
  expectBundleId,
  expectFuses,
  expectOwnIcon,
  expectValidSignature,
  SLOW_CHECK_MS,
  unpackedNatives,
  type Built,
} from './helpers/app-checks.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const version = (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }).version;

describe('SHA256SUMS.txt', () => {
  it('one line per installer at the top of the folder, in the format shasum -c reads back', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sums-'));
    try {
      fs.writeFileSync(path.join(dir, 'b.dmg'), 'bbb');
      fs.writeFileSync(path.join(dir, 'a.exe'), 'aaa');
      fs.writeFileSync(path.join(dir, 'notes.txt'), 'not an installer');
      fs.mkdirSync(path.join(dir, 'mac-arm64'));
      fs.writeFileSync(path.join(dir, 'mac-arm64', 'inner.zip'), 'unpacked app folder, skipped');
      const lines = writeChecksums(dir);
      expect(lines.map((l) => l.split('  ')[1])).toEqual(['a.exe', 'b.dmg']);
      expect(lines[1]).toBe('3e744b9dc39389baf0c5a0660589b8402f3dbb49b89b3e75f2c9355852a3c677  b.dmg');
      expect(() => execFileSync('shasum', ['-a', '256', '-c', SUMS_FILE], { cwd: dir, stdio: 'pipe' })).not.toThrow();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses an empty folder instead of writing an empty file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sums-'));
    try {
      expect(() => writeChecksums(dir)).toThrow(/no installers/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------- the images ----------

const IMAGES = [
  { arch: 'arm64', lipo: 'arm64', libsql: '@libsql/darwin-arm64' },
  { arch: 'x64', lipo: 'x86_64', libsql: '@libsql/darwin-x64' },
].map((i) => ({ ...i, file: path.join(dist, `Balance-Insights-${version}-mac-${i.arch}.dmg`) }));

const present = process.platform === 'darwin' && process.env.DMG_CHECK === '1' ? IMAGES.filter((i) => fs.existsSync(i.file)) : [];
if (process.env.DMG_CHECK === '1' && present.length !== IMAGES.length) {
  throw new Error(`DMG_CHECK=1 but missing: ${IMAGES.filter((i) => !present.includes(i)).map((i) => path.basename(i.file)).join(', ')}`);
}

describe.skipIf(present.length === 0)('.dmg images', () => {
  it('SHA256SUMS.txt in dist/ matches the images', () => {
    expect(() => execFileSync('shasum', ['-a', '256', '-c', SUMS_FILE], { cwd: dist, stdio: 'pipe' })).not.toThrow();
    const listed = fs.readFileSync(path.join(dist, SUMS_FILE), 'utf8');
    for (const i of present) expect(listed).toContain(`  ${path.basename(i.file)}\n`);
  });

  describe.each(present)('$arch', (image) => {
    let mount = '';
    let app: Built;

    beforeAll(() => {
      const plist = execFileSync(
        'hdiutil',
        ['attach', '-readonly', '-nobrowse', '-noautoopen', '-noverify', '-mountrandom', os.tmpdir(), '-plist', image.file],
        { encoding: 'utf8' },
      );
      mount = /<key>mount-point<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)?.[1] ?? '';
      app = built(mount, 'darwin');
    }, SLOW_CHECK_MS);
    afterAll(() => {
      if (mount) execFileSync('hdiutil', ['detach', mount, '-force'], { stdio: 'pipe' });
    });

    it('the volume holds the app and a link to /Applications — nothing else visible', () => {
      expect(mount).not.toBe('');
      const visible = fs.readdirSync(mount).filter((n) => !n.startsWith('.'));
      expect(visible.sort()).toEqual(['Applications', `${PRODUCT}.app`]);
      expect(fs.readlinkSync(path.join(mount, 'Applications'))).toBe('/Applications');
    });

    it('the executable is for this image’s architecture', () => {
      expect(binaryArchs(app)).toEqual([image.lipo]);
    });

    it('the native libsql for this architecture is unpacked next to the asar', () => {
      expect(unpackedNatives(app).some((f) => f.includes(image.libsql))).toBe(true);
    });

    it('fuses, asar only, bundle id, asar contents, signature — as in dist/', async () => {
      await expectFuses(app);
      expectAsarOnly(app);
      expectBundleId(app);
      expectAsarContents(app);
      expectValidSignature(app);
      expectOwnIcon(app, path.join(root, 'build', 'icon.icns'));
    }, SLOW_CHECK_MS);
  });
});
