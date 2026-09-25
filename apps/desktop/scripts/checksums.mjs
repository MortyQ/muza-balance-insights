// SHA256SUMS.txt next to the installers, in the format `shasum -a 256 -c` / `sha256sum -c` read back.
//   node scripts/checksums.mjs dist
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SUMS_FILE = 'SHA256SUMS.txt';
const INSTALLER = /\.(dmg|exe|AppImage|deb|zip)$/;

/** @param {string} file */
function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * Hashes every installer at the top of `dir` (not in subfolders: those are unpacked apps) and writes SHA256SUMS.txt.
 * @param {string} dir
 * @returns {string[]} the lines written
 */
export function writeChecksums(dir) {
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && INSTALLER.test(e.name))
    .map((e) => e.name)
    .sort();
  if (names.length === 0) throw new Error(`no installers in ${dir}`);
  const lines = names.map((n) => `${sha256(path.join(dir, n))}  ${n}`);
  fs.writeFileSync(path.join(dir, SUMS_FILE), `${lines.join('\n')}\n`);
  return lines;
}

if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  const dir = process.argv[2];
  if (!dir) {
    process.stderr.write('Использование: node scripts/checksums.mjs <папка>\n');
    process.exitCode = 2;
  } else {
    for (const l of writeChecksums(dir)) process.stdout.write(`${l}\n`);
  }
}
