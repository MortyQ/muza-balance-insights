// The release job signs update.json with scripts/update-sign.mjs; installed copies verify it with the key in
// src/main/update/public-key.ts. Test keys are generated here — the real private key never leaves the GitHub secret.
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_ID,
  appPublicKeyPem,
  buildManifest,
  keysMatch,
  signingKeyFromEnv,
  writeSignedManifest,
} from '../scripts/update-sign.mjs';

const pair = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { privateKey, publicPem: String(publicKey.export({ type: 'spki', format: 'pem' })) };
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'update-sign-'));

function releaseDir(version = '1.2.3') {
  const dir = tmp();
  for (const f of [`Balance-Insights-${version}-mac-arm64.dmg`, `Balance-Insights-${version}-win-x64.exe`, `Balance-Insights-${version}-linux-x64.AppImage`]) {
    fs.writeFileSync(path.join(dir, f), `fake ${f}`);
  }
  fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), 'x');
  fs.writeFileSync(path.join(dir, 'Balance-Insights-1.2.3-win-x64.exe.blockmap'), 'x');
  return dir;
}

describe('update manifest signing', () => {
  it('the app ships a real ed25519 public key', () => {
    expect(createPublicKey(appPublicKeyPem()).asymmetricKeyType).toBe('ed25519');
  });

  it('keysMatch: the pair matches, another key does not', () => {
    const a = pair();
    expect(keysMatch(a.privateKey, a.publicPem)).toBe(true);
    expect(keysMatch(pair().privateKey, a.publicPem)).toBe(false);
  });

  it('the manifest lists only the installers of that version, with size and sha512 (base64)', () => {
    const m = buildManifest(releaseDir(), '1.2.3', '2026-10-01');
    expect(m.app).toBe(APP_ID);
    expect(m.version).toBe('1.2.3');
    expect(m.files.map((f) => [f.os, f.arch, f.name])).toEqual([
      ['linux', 'x64', 'Balance-Insights-1.2.3-linux-x64.AppImage'],
      ['mac', 'arm64', 'Balance-Insights-1.2.3-mac-arm64.dmg'],
      ['win', 'x64', 'Balance-Insights-1.2.3-win-x64.exe'],
    ]);
    for (const f of m.files) {
      expect(f.size).toBe(`fake ${f.name}`.length);
      expect(Buffer.from(f.sha512, 'base64')).toHaveLength(64);
    }
  });

  it('refuses a folder with an installer of another version, or with none', () => {
    const dir = releaseDir();
    fs.writeFileSync(path.join(dir, 'Balance-Insights-1.2.2-win-x64.exe'), 'old');
    expect(() => buildManifest(dir, '1.2.3')).toThrow(/not version 1\.2\.3/);
    expect(() => buildManifest(tmp(), '1.2.3')).toThrow(/no installers/);
  });

  it('writes update.json + a detached signature that verifies over the exact bytes; a changed byte does not', () => {
    const dir = releaseDir();
    const k = pair();
    writeSignedManifest(dir, buildManifest(dir, '1.2.3'), k.privateKey, k.publicPem);
    const bytes = fs.readFileSync(path.join(dir, 'update.json'));
    const sig = Buffer.from(fs.readFileSync(path.join(dir, 'update.json.sig'), 'utf8').trim(), 'base64');
    expect(verify(null, bytes, createPublicKey(k.publicPem), sig)).toBe(true);
    const tampered = Buffer.from(bytes);
    tampered.writeUInt8(tampered.readUInt8(tampered.length - 5) ^ 1, tampered.length - 5);
    expect(verify(null, tampered, createPublicKey(k.publicPem), sig)).toBe(false);
  });

  it('refuses to write when the key is not the pair of the app key (installed copies would refuse the update)', () => {
    const dir = releaseDir();
    expect(() => writeSignedManifest(dir, buildManifest(dir, '1.2.3'), pair().privateKey, pair().publicPem)).toThrow(/does not match/);
    expect(fs.existsSync(path.join(dir, 'update.json'))).toBe(false);
  });

  it('the key comes from the env (secret) or a file; never empty, only ed25519', () => {
    const k = pair();
    const pem = String(k.privateKey.export({ type: 'pkcs8', format: 'pem' }));
    expect(signingKeyFromEnv({ UPDATE_SIGNING_KEY: pem }).asymmetricKeyType).toBe('ed25519');
    const file = path.join(tmp(), 'k.pem');
    fs.writeFileSync(file, pem);
    expect(signingKeyFromEnv({ UPDATE_SIGNING_KEY_FILE: file }).asymmetricKeyType).toBe('ed25519');
    expect(() => signingKeyFromEnv({})).toThrow(/not set/);
    // Wrong secrets get a reason, never the secret itself.
    const pub = String(k.privateKey.export({ type: 'pkcs8', format: 'pem' }));
    const body = pub.split('\n')[1]!;
    expect(() => signingKeyFromEnv({ UPDATE_SIGNING_KEY: pair().publicPem })).toThrow(/PUBLIC key/);
    expect(() => signingKeyFromEnv({ UPDATE_SIGNING_KEY: body })).toThrow(/BEGIN\/END/);
    const cut = `-----BEGIN PRIVATE KEY-----\n${body.slice(0, 10)}\n-----END PRIVATE KEY-----\n`;
    let msg = '';
    try {
      signingKeyFromEnv({ UPDATE_SIGNING_KEY: cut });
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toMatch(/not a readable PEM/);
    expect(msg).not.toContain(body.slice(0, 10));
    const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
    expect(() => signingKeyFromEnv({ UPDATE_SIGNING_KEY: String(rsa) })).toThrow(/not ed25519/);
  });
});
