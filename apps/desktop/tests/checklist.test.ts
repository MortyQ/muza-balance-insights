// Electron Security Checklist items the other files do not cover: #15 (no shell.openExternal) and #16 (Electron
// not older than the major the plan was reviewed against). #16 only catches a downgrade: whether 44 is still
// supported is a review at every update.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = path.join(ROOT, 'src');
const MIN_ELECTRON_MAJOR = 44;

function listSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listSources(p);
    return /\.(ts|vue|mjs|js)$/.test(p) ? [p] : [];
  });
}
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

/** Any use of Electron's shell module: openExternal / openPath / showItemInFolder all hand URLs or paths to the OS. */
const SHELL_USE = /\bopenExternal\b|\bshell\s*\.\s*\w+|\{[^}]*\bshell\b[^}]*\}\s*=\s*require\(\s*['"]electron['"]|import\s*\{[^}]*\bshell\b[^}]*\}\s*from\s*['"]electron['"]/;

describe('#15 shell.openExternal', () => {
  it('no source file uses the shell module (review this test when a link to the outside is really needed)', () => {
    const files = listSources(SRC);
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.filter((f) => SHELL_USE.test(stripComments(fs.readFileSync(f, 'utf8')))).map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it('control: the scan catches decoys and ignores look-alikes', () => {
    for (const decoy of [
      "import { app, shell } from 'electron';",
      "await shell.openExternal('https://x')",
      'electron.shell . openPath(p)',
      "const { shell } = require('electron');",
    ])
      expect(SHELL_USE.test(decoy)).toBe(true);
    for (const ok of ["import { app } from 'electron';", 'const shellColor = 1;', "powershell('x')"]) expect(SHELL_USE.test(ok)).toBe(false);
  });
});

describe('#16 Electron version', () => {
  it(`installed Electron and the declared range are at least ${MIN_ELECTRON_MAJOR}`, () => {
    const require = createRequire(path.join(ROOT, 'package.json'));
    const installed = (require('electron/package.json') as { version: string }).version;
    expect(Number(installed.split('.')[0])).toBeGreaterThanOrEqual(MIN_ELECTRON_MAJOR);
    const declared = (JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { devDependencies: Record<string, string> })
      .devDependencies.electron!;
    expect(Number(/(\d+)/.exec(declared)![1])).toBeGreaterThanOrEqual(MIN_ELECTRON_MAJOR);
  });
});
