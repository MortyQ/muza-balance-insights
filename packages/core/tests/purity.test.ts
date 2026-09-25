// packages/core must run anywhere (Node, Electron main, a worker, later a browser): no platform code in src/.
// Platform services come in through parameters (src/platform.ts). Second line of defence: tsconfig.json
// compiles src/ with lib WebWorker and no @types/node, so Node globals don't even typecheck.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = fileURLToPath(new URL('..', import.meta.url));
const SRC = path.join(CORE, 'src');

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

function listTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listTs(p);
    return p.endsWith('.ts') ? [p] : [];
  });
}

const NODE_BUILTINS = ['fs', 'fs/promises', 'path', 'os', 'url', 'util', 'crypto', 'child_process', 'net', 'http', 'https', 'stream', 'worker_threads', 'buffer', 'events', 'process'];

const RULES: Array<[string, RegExp]> = [
  ['node: import', /['"]node:[^'"]+['"]/],
  ['Node builtin import', new RegExp(`(?:\\bfrom\\s*|\\bimport\\s*\\(?\\s*|\\brequire\\s*\\(\\s*)['"](?:${NODE_BUILTINS.join('|').replace(/\//g, '\\/')})['"]`)],
  ['Node global', /\b(process|Buffer|require|__dirname|__filename)\b|\bglobal\./],
  ['import.meta', /\bimport\.meta\b/],
  ['global fetch', /\bglobalThis\b|(?<![.\w])fetch\s*\(/],
  ['wall clock', /\bDate\.now\b|\bnew Date\(\s*\)|\bperformance\.now\b/],
  ['timers', /\b(setTimeout|setInterval|setImmediate|queueMicrotask)\b/],
  ['console', /\bconsole\./],
  // Member access only: «window» is also a sync term (statement windows) in names and SQL comments.
  ['browser global', /\b(localStorage|sessionStorage|indexedDB|document|window|navigator|self)\./],
];

function violations(code: string): string[] {
  const clean = stripComments(code);
  return RULES.filter(([, re]) => re.test(clean)).map(([name]) => name);
}

describe('core purity', () => {
  it('no platform code in packages/core/src', () => {
    const files = listTs(SRC);
    expect(files.length).toBeGreaterThan(15); // the scan really sees the sources
    const offenders = files
      .map((f) => ({ file: path.relative(CORE, f), found: violations(fs.readFileSync(f, 'utf8')) }))
      .filter((o) => o.found.length > 0);
    expect(offenders).toEqual([]);
  });

  it('control: every rule fires on a decoy (the test is not blind)', () => {
    const decoys: Record<string, string> = {
      'node: import': `import fs from 'node:fs';`,
      'Node builtin import': `import path from 'path';`,
      'Node global': `const t = process.env.MONO_TOKEN;`,
      'import.meta': `const u = new URL('.', import.meta.url);`,
      'global fetch': `await fetch('https://example.invalid');`,
      'wall clock': `const now = Date.now();`,
      timers: `setTimeout(() => {}, 1);`,
      console: `console.error('x');`,
      'browser global': `localStorage.setItem('k', 'v');`,
    };
    expect(Object.keys(decoys).sort()).toEqual(RULES.map(([n]) => n).sort());
    for (const [rule, code] of Object.entries(decoys)) expect(violations(code), rule).toContain(rule);
    // Injected fetch and dates from data are fine.
    expect(violations(`const r = await opts.fetch(url, init); const d = new Date(ms);`)).toEqual([]);
    // Comments are ignored.
    expect(violations(`// process.env and Date.now() in a comment`)).toEqual([]);
  });

  it('runtime dependencies: only zod and @date-fns/tz; no adapters', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(CORE, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(['@date-fns/tz', 'zod']);
    expect(pkg.peerDependencies ?? {}).toEqual({});
    expect(pkg.optionalDependencies ?? {}).toEqual({});
  });

  it('src only imports its own files and the allowed dependencies', () => {
    const allowed = /^(\.\.?\/|zod$|@date-fns\/tz$)/;
    const offenders: string[] = [];
    for (const f of listTs(SRC)) {
      const code = stripComments(fs.readFileSync(f, 'utf8'));
      for (const m of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)) {
        if (!allowed.test(m[1]!)) offenders.push(`${path.relative(CORE, f)}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('tsconfig for src: WebWorker lib, no ambient @types (Node globals do not typecheck)', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(CORE, 'tsconfig.json'), 'utf8'));
    expect(cfg.compilerOptions.lib).toEqual(['ES2023', 'WebWorker']);
    expect(cfg.compilerOptions.types).toEqual([]);
    expect(cfg.include).toEqual(['src']);
  });
});
