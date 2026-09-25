// Electron ≥ 42 has no postinstall: the binary is fetched by its `install-electron` bin (or lazily by the `electron` CLI).
// electron-vite locates the binary itself via path.txt and does not trigger that download, so on a clean install
// `pnpm dev` fails with "Electron uninstall". This script is the explicit, repeatable install step (CI included)
// and the check that `dev` / `build` run inline before anything else.
//   node scripts/electron-binary.mjs --check     exit 1 with a hint if the binary is missing
//   node scripts/electron-binary.mjs --install   run Electron's own install.js (checksums from the package), then check
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const INSTALL_HINT = 'pnpm --filter @mono/desktop run binary:install';

/**
 * Same executable path as Electron's install.js getPlatformPath().
 * @param {string} [platform]
 * @returns {string}
 */
export function platformPath(platform = os.platform()) {
  switch (platform) {
    case 'mas':
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron';
    case 'freebsd':
    case 'openbsd':
    case 'linux':
      return 'electron';
    case 'win32':
      return 'electron.exe';
    default:
      throw new Error(`Electron builds are not available on platform: ${platform}`);
  }
}

/**
 * Mirrors isInstalled() in Electron's install.js: dist/version = package version, path.txt = platform path,
 * the executable exists. Returns null when installed, otherwise a human-readable reason.
 * @param {string} electronDir
 * @param {{ platform?: string, overrideDistPath?: string }} [opts]
 * @returns {string | null}
 */
export function missingReason(electronDir, opts = {}) {
  const version = JSON.parse(fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8')).version;
  const expectedPath = platformPath(opts.platform);
  let distVersion;
  try {
    distVersion = fs.readFileSync(path.join(electronDir, 'dist', 'version'), 'utf8').trim().replace(/^v/, '');
  } catch {
    return `бинарник Electron ${version} не скачан (нет dist/version)`;
  }
  if (distVersion !== version) return `в dist лежит Electron ${distVersion}, а пакет — ${version}`;
  let recorded;
  try {
    recorded = fs.readFileSync(path.join(electronDir, 'path.txt'), 'utf8');
  } catch {
    return 'нет path.txt';
  }
  if (recorded !== expectedPath) return `path.txt указывает на «${recorded}», ожидается «${expectedPath}»`;
  const exe = path.join(opts.overrideDistPath ?? path.join(electronDir, 'dist'), expectedPath);
  if (!fs.existsSync(exe)) return `нет исполняемого файла ${path.relative(electronDir, exe)}`;
  return null;
}

/** Resolves node_modules/electron of this package without executing it (its index.js would start a download). */
export function electronDir() {
  const require = createRequire(import.meta.url);
  return path.dirname(require.resolve('electron/package.json'));
}

/** @param {string[]} argv */
function main(argv) {
  const dir = electronDir();
  const opts = { overrideDistPath: process.env.ELECTRON_OVERRIDE_DIST_PATH };
  if (argv.includes('--install')) {
    const r = spawnSync(process.execPath, [path.join(dir, 'install.js')], { stdio: 'inherit' });
    if (r.status !== 0) {
      process.stderr.write('Не удалось скачать Electron (см. ошибку выше). Сеть до github.com и повтор той же команды.\n');
      return 1;
    }
  } else if (!argv.includes('--check')) {
    process.stderr.write('Использование: node scripts/electron-binary.mjs --check | --install\n');
    return 2;
  }
  const reason = missingReason(dir, opts);
  if (reason) {
    process.stderr.write(`Electron не готов: ${reason}.\nВыполни в корне репозитория: ${INSTALL_HINT}\n`);
    return 1;
  }
  return 0;
}

// Real paths on both sides: with a symlinked path (macOS /var → /private/var) a plain comparison would skip main()
// and the check would "pass" with exit 0 — the worst way for a check to fail.
if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
