// No source or test file of the workspace may fall under .gitignore: it would work locally and be missing from a
// fresh clone (CI). It happened: `analysis/` (meant for the root copy) also hid apps/mcp/src/analysis/.
// The data rules keep working: the root /data/, /analysis/, /reports/ and *.db, .env* anywhere stay ignored.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const SKIP = new Set(['node_modules', 'dist', 'out', '.cache']);

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name) || e.name.startsWith('.')) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p) : [p];
  });
}

/** Paths (relative to the repo) that git would ignore. */
function ignored(paths: string[]): string[] {
  try {
    return execFileSync('git', ['check-ignore', '--stdin'], { cwd: REPO, input: paths.join('\n'), encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) {
    // Exit 1 = none of them is ignored.
    if ((e as { status?: number }).status === 1) return [];
    throw e;
  }
}

describe.runIf(fs.existsSync(path.join(REPO, '.git')))('.gitignore vs the workspace', () => {
  it('no file under apps/*/{src,tests,scripts,build} or packages/*/{src,tests} is ignored', () => {
    const roots = ['apps', 'packages'].flatMap((top) =>
      fs.readdirSync(path.join(REPO, top)).flatMap((pkg) =>
        ['src', 'tests', 'scripts', 'build'].map((d) => path.join(REPO, top, pkg, d)).filter((d) => fs.existsSync(d)),
      ),
    );
    const files = roots.flatMap(listFiles).map((f) => path.relative(REPO, f));
    expect(files.length).toBeGreaterThan(100);
    expect(ignored(files)).toEqual([]);
  });

  it('the data rules still hold: root data/, analysis/, reports/, and *.db / .env anywhere', () => {
    const must = ['data/x', 'analysis/analysis.sqlite', 'reports/r.md', 'reply.md', 'apps/mcp/x.db', 'apps/mcp/x.db-wal', 'apps/mcp/.env', '.env.local'];
    expect(ignored(must).sort()).toEqual([...must].sort());
    expect(ignored(['.env.example'])).toEqual([]);
  });
});
