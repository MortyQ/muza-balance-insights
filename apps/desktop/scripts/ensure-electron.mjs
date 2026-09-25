// Runs inline first in `dev` and `build` (no postinstall / lifecycle hooks): after `pnpm install` wiped the binary,
// fetch it with Electron's own install.js (checksums from the package) instead of failing. Binary in place → nothing
// happens. Download failed (no network, TLS) → exit 1 with the command to run by hand.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { electronDir, INSTALL_HINT, missingReason } from './electron-binary.mjs';

/**
 * Electron's install.js in a child Node process; true when it exited 0.
 * @param {string} dir
 * @returns {boolean}
 */
export function runInstallJs(dir) {
  return spawnSync(process.execPath, [path.join(dir, 'install.js')], { stdio: 'inherit' }).status === 0;
}

/**
 * @param {{ dir: string, platform?: string, overrideDistPath?: string, install?: (dir: string) => boolean,
 *   write?: (s: string) => void }} opts
 * @returns {number} exit code
 */
export function ensureElectron(opts) {
  const { dir, install = runInstallJs, write = (s) => process.stderr.write(s) } = opts;
  const check = () => missingReason(dir, { platform: opts.platform, overrideDistPath: opts.overrideDistPath });
  const reason = check();
  if (reason === null) return 0;
  write(`Electron не готов: ${reason}. Скачиваю…\n`);
  const ok = install(dir);
  const after = check();
  if (ok && after === null) return 0;
  write(
    `Не удалось скачать Electron${after ? ` (${after})` : ''}: нужна сеть до github.com.\n` +
      `Выполни в корне репозитория: ${INSTALL_HINT}\n`,
  );
  return 1;
}

// Real paths on both sides, as in electron-binary.mjs: a symlinked path would otherwise skip the run with exit 0.
if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  process.exitCode = ensureElectron({ dir: electronDir(), overrideDistPath: process.env.ELECTRON_OVERRIDE_DIST_PATH });
}
