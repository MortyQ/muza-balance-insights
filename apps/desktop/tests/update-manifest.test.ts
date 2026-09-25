// What the app accepts as an update: the manifest written by scripts/update-sign.mjs (the same code the release job
// runs), verified with the key inside the app. Test keys only.
import { generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildManifest, writeSignedManifest } from '../scripts/update-sign.mjs';
import { APP_ID, UpdateRejected, fileMatches, pickFile, verifyManifest, type Manifest } from '../src/main/update/manifest.ts';
import { isNewer, parseVersion } from '../src/main/update/version.ts';

const pair = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { privateKey, publicPem: String(publicKey.export({ type: 'spki', format: 'pem' })) };
};
const KEY = pair();

function signedRelease(version = '0.3.0', files = ['mac-arm64.dmg', 'mac-x64.dmg', 'win-x64.exe', 'linux-x64.AppImage']) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-manifest-'));
  for (const f of files) fs.writeFileSync(path.join(dir, `Balance-Insights-${version}-${f}`), `bytes of ${f}`);
  writeSignedManifest(dir, buildManifest(dir, version, '2026-10-01'), KEY.privateKey, KEY.publicPem);
  return {
    dir,
    bytes: fs.readFileSync(path.join(dir, 'update.json')),
    sig: fs.readFileSync(path.join(dir, 'update.json.sig'), 'utf8'),
  };
}
const resign = (json: unknown) => {
  const bytes = Buffer.from(JSON.stringify(json));
  return { bytes, sig: sign(null, bytes, KEY.privateKey).toString('base64') };
};
const code = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof UpdateRejected ? e.code : 'other';
  }
};

describe('versions', () => {
  it.each([
    ['0.2.0', '0.1.9', true],
    ['0.1.10', '0.1.9', true],
    ['1.0.0', '0.99.99', true],
    ['0.2.0', '0.2.0', false],
    ['0.1.9', '0.2.0', false],
    ['0.3.0-beta.1', '0.2.0', false],
    ['v0.3.0', '0.2.0', false],
    ['', '0.2.0', false],
  ])('isNewer(%s, %s) = %s', (a, b, want) => {
    expect(isNewer(a, b)).toBe(want);
  });
  it('parses x.y.z only', () => {
    expect(parseVersion('1.22.333')).toEqual([1, 22, 333]);
    expect(parseVersion('1.2')).toBeNull();
  });
});

describe('signed manifest', () => {
  it('the manifest from the release script verifies and parses', () => {
    const r = signedRelease();
    const m = verifyManifest(r.bytes, r.sig, KEY.publicPem, '0.2.0');
    expect(m.app).toBe(APP_ID);
    expect(m.version).toBe('0.3.0');
    expect(m.files).toHaveLength(4);
  });

  it('a changed byte, another key, a missing or garbage signature → signature', () => {
    const r = signedRelease();
    const flipped = Buffer.from(r.bytes);
    flipped.writeUInt8(flipped.readUInt8(10) ^ 1, 10);
    expect(code(() => verifyManifest(flipped, r.sig, KEY.publicPem, '0.2.0'))).toBe('signature');
    expect(code(() => verifyManifest(r.bytes, r.sig, pair().publicPem, '0.2.0'))).toBe('signature');
    expect(code(() => verifyManifest(r.bytes, '', KEY.publicPem, '0.2.0'))).toBe('signature');
    expect(code(() => verifyManifest(r.bytes, 'not base64 at all!!', KEY.publicPem, '0.2.0'))).toBe('signature');
  });

  it('the same or an older version, even correctly signed → not-newer (no rollback with an old manifest)', () => {
    const r = signedRelease('0.2.0');
    expect(code(() => verifyManifest(r.bytes, r.sig, KEY.publicPem, '0.2.0'))).toBe('not-newer');
    expect(code(() => verifyManifest(r.bytes, r.sig, KEY.publicPem, '0.2.1'))).toBe('not-newer');
  });

  it('signed but not ours, not the shape, or with a file name that is a path → refused', () => {
    const good = JSON.parse(signedRelease().bytes.toString('utf8')) as Manifest;
    const other = resign({ ...good, app: 'com.example.other' });
    expect(code(() => verifyManifest(other.bytes, other.sig, KEY.publicPem, '0.2.0'))).toBe('app');
    const extra = resign({ ...good, url: 'https://evil.example/x.exe' });
    expect(code(() => verifyManifest(extra.bytes, extra.sig, KEY.publicPem, '0.2.0'))).toBe('format');
    const traversal = resign({ ...good, files: [{ ...good.files[0]!, name: '../../Balance-Insights-0.3.0-win-x64.exe' }] });
    expect(code(() => verifyManifest(traversal.bytes, traversal.sig, KEY.publicPem, '0.2.0'))).toBe('format');
    const wrongVersion = resign({ ...good, files: [{ ...good.files[0]!, name: 'Balance-Insights-0.9.0-linux-x64.AppImage' }] });
    expect(code(() => verifyManifest(wrongVersion.bytes, wrongVersion.sig, KEY.publicPem, '0.2.0'))).toBe('file-name');
    const wrongOs = resign({ ...good, files: [{ ...good.files[0]!, os: 'win' }] });
    expect(code(() => verifyManifest(wrongOs.bytes, wrongOs.sig, KEY.publicPem, '0.2.0'))).toBe('file-name');
    const notJson = (() => {
      const bytes = Buffer.from('{not json');
      return { bytes, sig: sign(null, bytes, KEY.privateKey).toString('base64') };
    })();
    expect(code(() => verifyManifest(notJson.bytes, notJson.sig, KEY.publicPem, '0.2.0'))).toBe('format');
  });

  it('pickFile: this OS and arch only; nothing for a build that does not exist', () => {
    const r = signedRelease();
    const m = verifyManifest(r.bytes, r.sig, KEY.publicPem, '0.2.0');
    expect(pickFile(m, 'darwin', 'arm64')?.name).toBe('Balance-Insights-0.3.0-mac-arm64.dmg');
    expect(pickFile(m, 'darwin', 'x64')?.name).toBe('Balance-Insights-0.3.0-mac-x64.dmg');
    expect(pickFile(m, 'win32', 'x64')?.name).toBe('Balance-Insights-0.3.0-win-x64.exe');
    expect(pickFile(m, 'linux', 'x64')?.name).toBe('Balance-Insights-0.3.0-linux-x64.AppImage');
    expect(pickFile(m, 'win32', 'arm64')).toBeNull();
    expect(pickFile(m, 'freebsd', 'x64')).toBeNull();
  });

  it('fileMatches: size and sha512 of the file on disk against the manifest', async () => {
    const r = signedRelease();
    const m = verifyManifest(r.bytes, r.sig, KEY.publicPem, '0.2.0');
    const f = m.files.find((x) => x.os === 'win')!;
    const file = path.join(r.dir, f.name);
    expect(await fileMatches(file, f)).toBe(true);
    fs.appendFileSync(file, 'x');
    expect(await fileMatches(file, f)).toBe(false);
    fs.writeFileSync(file, 'bytes of win-x64.exf'); // same size, other bytes
    expect(await fileMatches(file, f)).toBe(false);
    expect(await fileMatches(path.join(r.dir, 'missing.exe'), f)).toBe(false);
  });
});
