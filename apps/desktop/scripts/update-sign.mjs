// Signs update manifests with the ed25519 key from scripts/update-keygen.mjs. Node built-ins only (runs in the release
// job without installing anything). The key comes from UPDATE_SIGNING_KEY (PEM, the GitHub Environment secret) or, for
// a local check, UPDATE_SIGNING_KEY_FILE. Nothing here ever prints the key.
//   node apps/desktop/scripts/update-sign.mjs check                      does the key match the app's public key?
//   node apps/desktop/scripts/update-sign.mjs manifest <dir> <version>   write <dir>/update.json and update.json.sig
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const APP_ID = 'io.github.mortyq.balanceinsights';
export const MANIFEST = 'update.json';
export const SIGNATURE = 'update.json.sig';
/** The installers a release carries (artifactName in electron-builder.json). */
export const INSTALLER = /^Balance-Insights-(\d+\.\d+\.\d+)-(mac|win|linux)-(arm64|x64)\.(dmg|exe|AppImage)$/;

const PUBLIC_KEY_FILE = fileURLToPath(new URL('../src/main/update/public-key.ts', import.meta.url));

/** The PEM inside src/main/update/public-key.ts — the key every installed copy checks against. */
export function appPublicKeyPem(file = PUBLIC_KEY_FILE) {
  const m = /`(-----BEGIN PUBLIC KEY-----[\s\S]+?-----END PUBLIC KEY-----\n?)`/.exec(fs.readFileSync(file, 'utf8'));
  if (!m?.[1]) throw new Error(`no public key in ${file}`);
  return m[1];
}

export function signingKeyFromEnv(env = process.env) {
  const pem = env.UPDATE_SIGNING_KEY || (env.UPDATE_SIGNING_KEY_FILE ? fs.readFileSync(env.UPDATE_SIGNING_KEY_FILE, 'utf8') : '');
  if (!pem.trim()) throw new Error('UPDATE_SIGNING_KEY (or UPDATE_SIGNING_KEY_FILE) is not set');
  // Say what is wrong with the secret without ever showing it.
  if (pem.includes('BEGIN PUBLIC KEY')) throw new Error('the signing key is a PUBLIC key: put the private key file content into the secret');
  if (!pem.includes('-----BEGIN PRIVATE KEY-----') || !pem.includes('-----END PRIVATE KEY-----')) {
    throw new Error('the signing key has no BEGIN/END PRIVATE KEY lines: paste the whole private key file, all three lines');
  }
  let key;
  try {
    key = createPrivateKey(pem);
  } catch {
    throw new Error('the signing key is not a readable PEM private key (cut off, extra characters or quotes?)');
  }
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('the signing key is not ed25519');
  return key;
}

/**
 * true when `privateKey` signs what `publicPem` verifies — a fresh random message each time.
 * @param {import('node:crypto').KeyObject} privateKey
 * @param {string} publicPem
 */
export function keysMatch(privateKey, publicPem) {
  const msg = randomBytes(32);
  return verify(null, msg, createPublicKey(publicPem), sign(null, msg, privateKey));
}

/**
 * @typedef {{ os: string; arch: string; name: string; size: number; sha512: string }} ManifestFile
 * @typedef {{ app: string; version: string; released: string; files: ManifestFile[] }} Manifest
 */

/**
 * The manifest of every installer in `dir` for `version`; sha512 in base64, as electron-updater's latest.yml has it.
 * @param {string} dir
 * @param {string} version
 * @returns {Manifest}
 */
export function buildManifest(dir, version, released = new Date().toISOString().slice(0, 10)) {
  const files = fs
    .readdirSync(dir)
    .flatMap((name) => {
      const m = INSTALLER.exec(name);
      return m ? [{ name, m }] : [];
    })
    .map(({ name, m }) => {
      if (m[1] !== version) throw new Error(`${name} is not version ${version}`);
      const bytes = fs.readFileSync(path.join(dir, name));
      return { os: m[2] ?? '', arch: m[3] ?? '', name, size: bytes.length, sha512: createHash('sha512').update(bytes).digest('base64') };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  if (files.length === 0) throw new Error(`no installers for ${version} in ${dir}`);
  return { app: APP_ID, version, released, files };
}

/**
 * Writes update.json and its detached signature (base64), after checking the signature with the app's public key.
 * @param {string} dir
 * @param {Manifest} manifest
 * @param {import('node:crypto').KeyObject} privateKey
 * @param {string} publicPem
 */
export function writeSignedManifest(dir, manifest, privateKey, publicPem) {
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const signature = sign(null, bytes, privateKey);
  if (!verify(null, bytes, createPublicKey(publicPem), signature)) {
    throw new Error("the signing key does not match the app's public key: installed copies would refuse this update");
  }
  fs.writeFileSync(path.join(dir, MANIFEST), bytes);
  fs.writeFileSync(path.join(dir, SIGNATURE), `${signature.toString('base64')}\n`);
}

/** @param {string[]} argv */
function main(argv) {
  const [cmd, dir, version] = argv;
  const key = signingKeyFromEnv();
  const publicPem = appPublicKeyPem();
  if (cmd === 'check') {
    if (!keysMatch(key, publicPem)) {
      console.error("NO MATCH: the signing key is not the pair of src/main/update/public-key.ts");
      process.exit(1);
    }
    console.log("OK: the signing key matches the app's public key");
    return;
  }
  if (cmd === 'manifest' && dir && version) {
    const manifest = buildManifest(dir, version);
    writeSignedManifest(dir, manifest, key, publicPem);
    console.log(`${MANIFEST} for ${version}: ${manifest.files.map((f) => f.name).join(', ')} — signed and verified`);
    return;
  }
  console.error('Usage: update-sign.mjs check | update-sign.mjs manifest <dir> <version>');
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));
