// Creates the ed25519 key pair that signs update manifests. Run by the author only — never by an agent, never in CI.
//   node apps/desktop/scripts/update-keygen.mjs <path for the private key, outside the repository>
// The private key goes into the GitHub Environment secret UPDATE_SIGNING_KEY (and a password manager); the public key
// is written into the app (src/main/update/public-key.ts) and committed. Refuses to overwrite either file: a new key
// means every installed copy refuses the next update until it is reinstalled by hand.
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const privatePath = process.argv[2];
const repoRoot = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const publicFile = fileURLToPath(new URL('../src/main/update/public-key.ts', import.meta.url));

if (!privatePath) {
  console.error('Usage: node apps/desktop/scripts/update-keygen.mjs <path for the private key, outside the repository>');
  process.exit(1);
}
const privateAbs = path.resolve(privatePath);
if (privateAbs === repoRoot || privateAbs.startsWith(repoRoot + path.sep)) {
  console.error('The private key must not be inside the repository.');
  process.exit(1);
}
for (const f of [privateAbs, publicFile]) {
  if (fs.existsSync(f)) {
    console.error(`${f} already exists — not overwriting a signing key.`);
    process.exit(1);
  }
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
fs.writeFileSync(privateAbs, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
const pem = String(publicKey.export({ type: 'spki', format: 'pem' })).trim();
fs.mkdirSync(path.dirname(publicFile), { recursive: true });
fs.writeFileSync(
  publicFile,
  `// Public half of the update signing key (scripts/update-keygen.mjs). An update is installed only if its manifest\n` +
    `// verifies against this key. Changing it = every installed copy refuses updates until reinstalled by hand.\n` +
    `export const UPDATE_PUBLIC_KEY = \`${pem}\n\`;\n`,
  { flag: 'wx' },
);

console.log(`Private key: ${privateAbs} (mode 600)`);
console.log(`Public key:  ${path.relative(repoRoot, publicFile)}`);
console.log('Next: paste the private key file content into the GitHub Environment "release" secret UPDATE_SIGNING_KEY,');
console.log('keep a copy in your password manager, then delete the file.');
