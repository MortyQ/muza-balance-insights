// recategorize (apps/mcp package.json) runs outside the OS sandbox and the agent reads its output.
// Guards: (1) no .env / token anywhere in its import graph; (2) its output has no sensitive fields.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Db } from '../src/db.ts';
import { MCP_ROOT, REPO_ROOT } from '../src/paths.ts';
import { rederiveAll } from '../src/rederive.ts';
import { insertAccountRow, memoryDb } from '@mono/core/test-helpers';

const ENTRY = path.join(MCP_ROOT, 'src', 'cli', 'recategorize.ts');

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

/** Workspace packages by name → { dir, exports }, read from their package.json. */
function workspacePackages(): Map<string, { dir: string; exports: Record<string, string> }> {
  const out = new Map<string, { dir: string; exports: Record<string, string> }>();
  for (const group of ['packages', 'apps']) {
    for (const name of fs.readdirSync(path.join(REPO_ROOT, group))) {
      const dir = path.join(REPO_ROOT, group, name);
      const pkgPath = path.join(dir, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      out.set(pkg.name, { dir, exports: typeof pkg.exports === 'string' ? { '.': pkg.exports } : (pkg.exports ?? {}) });
    }
  }
  return out;
}

const WORKSPACE = workspacePackages();

/**
 * Resolves a workspace import (`@mono/core/sync`, `@mono/db-libsql`) through the package's `exports`, like Node does
 * (exact key first, then `./*` patterns). Fails loudly on a workspace specifier it can't resolve —
 * an unresolved import would make the graph silently smaller and this test blind.
 */
function resolveWorkspaceImport(spec: string): string {
  const name = [...WORKSPACE.keys()].find((n) => spec === n || spec.startsWith(`${n}/`));
  if (!name) throw new Error(`Не workspace-пакет или неизвестный пакет: ${spec}`);
  const { dir, exports } = WORKSPACE.get(name)!;
  const sub = spec === name ? '.' : `./${spec.slice(name.length + 1)}`;
  if (exports[sub]) return path.join(dir, exports[sub]);
  for (const [key, target] of Object.entries(exports)) {
    const star = key.indexOf('*');
    if (star === -1) continue;
    const [pre, post] = [key.slice(0, star), key.slice(star + 1)];
    if (sub.startsWith(pre) && sub.endsWith(post) && sub.length >= pre.length + post.length) {
      return path.join(dir, target.replace('*', sub.slice(pre.length, sub.length - post.length)));
    }
  }
  throw new Error(`${spec}: нет такого экспорта в ${name}`);
}

const isWorkspaceSpec = (spec: string) => spec.startsWith('@mono/');

/** Transitive closure of relative and workspace imports / re-exports (static and dynamic), as absolute .ts paths. */
function importClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    if (!fs.existsSync(file)) throw new Error(`Импорт не найден: ${file}`);
    seen.add(file);
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)) {
      const spec = m[1]!;
      if (spec.startsWith('.')) stack.push(path.resolve(path.dirname(file), spec));
      else if (isWorkspaceSpec(spec)) stack.push(resolveWorkspaceImport(spec));
      // Third-party packages (zod, @libsql/client, …) are not followed.
    }
  }
  return seen;
}

const rel = (files: Iterable<string>) => [...files].map((f) => path.relative(REPO_ROOT, f)).sort();

describe('recategorize: no .env, no token', () => {
  it('the import graph is found, across packages (control: sync reaches config.ts; recategorize reaches core and the adapter)', () => {
    expect(rel(importClosure(path.join(MCP_ROOT, 'src', 'cli', 'sync.ts')))).toContain('apps/mcp/src/config.ts');
    expect(rel(importClosure(ENTRY))).toEqual(
      expect.arrayContaining([
        'apps/mcp/src/rederive.ts',
        'apps/mcp/src/analysis/export.ts',
        'packages/core/src/rederive.ts',
        'packages/core/src/transfers.ts',
        'packages/core/src/db.ts',
        'packages/db-libsql/src/index.ts',
      ]),
    );
  });

  it('the resolver follows package exports and refuses what it cannot resolve', () => {
    expect(path.relative(REPO_ROOT, resolveWorkspaceImport('@mono/core/sync'))).toBe('packages/core/src/sync.ts');
    expect(path.relative(REPO_ROOT, resolveWorkspaceImport('@mono/core/test-helpers'))).toBe('packages/core/tests/helpers.ts');
    expect(path.relative(REPO_ROOT, resolveWorkspaceImport('@mono/db-libsql'))).toBe('packages/db-libsql/src/index.ts');
    expect(() => resolveWorkspaceImport('@mono/unknown/x')).toThrow();
    expect(() => importClosure(path.join(MCP_ROOT, 'src', 'no-such-file.ts'))).toThrow(/не найден/);
  });

  it('no file reachable from apps/mcp/src/cli/recategorize.ts imports config.ts or touches .env / the token', () => {
    const closure = importClosure(ENTRY);
    expect(rel(closure)).not.toContain('apps/mcp/src/config.ts');
    const offenders = rel(
      [...closure].filter((f) => /getToken|MONO_TOKEN|loadEnvFile|dotenv|['"`/]\.env\b/.test(stripComments(fs.readFileSync(f, 'utf8')))),
    );
    expect(offenders).toEqual([]);
  });

  it('package.json runs exactly this entry point, preceded by these safety checks (neither can be repointed silently)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(MCP_ROOT, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('@mono/mcp');
    expect(pkg.scripts.recategorize).toBe('vitest run tests/recategorize-safety.test.ts && node --import tsx src/cli/recategorize.ts');
  });

  it('no pre/post hooks and no other recategorize script anywhere in the workspace', () => {
    const manifests = [path.join(REPO_ROOT, 'package.json'), ...[...WORKSPACE.values()].map((p) => path.join(p.dir, 'package.json'))];
    expect(manifests.length).toBeGreaterThanOrEqual(4);
    for (const m of manifests) {
      const scripts: Record<string, string> = JSON.parse(fs.readFileSync(m, 'utf8')).scripts ?? {};
      const rm = path.relative(REPO_ROOT, m);
      expect(Object.keys(scripts).filter((k) => /^(pre|post)/.test(k)), rm).toEqual([]);
      const mentions = Object.entries(scripts).filter(([k, v]) => k !== 'recategorize' && /recategorize/.test(`${k} ${v}`));
      expect(mentions, rm).toEqual([]);
      if (rm !== 'apps/mcp/package.json') expect(scripts.recategorize, rm).toBeUndefined();
    }
  });
});

describe('recategorize: output is aggregates and diagnostics only', () => {
  it('recategorize.ts and both rederive.ts never mention sensitive columns', () => {
    for (const f of ['apps/mcp/src/cli/recategorize.ts', 'apps/mcp/src/rederive.ts', 'packages/core/src/rederive.ts']) {
      const code = stripComments(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'));
      expect(code.match(/\b(description|counter_name|counterName|comment|iban|counter_iban|masked_pan|maskedPan|title)\b/g), f).toBeNull();
    }
  });

  // Fictional values; each must be absent from the report.
  const CANARY = {
    iban: 'UA00CANARYIBAN0000000009',
    pan: '537541******0099',
    jarTitle: 'CanaryJarForRecat',
    counterName: 'Canary Recategorenko',
    counterIban: 'UA00CANARYCOUNTER0000009',
    comment: 'canary recat comment',
    description: 'Canary Shop Description',
    treasury: 'ГУК Canary Recat/18050400',
  };

  let db: Db;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recat-test-'));
    db = await memoryDb();
    await insertAccountRow(db, {
      id: 'card1', kind: 'card', type: 'black', currency_code: 980, iban: CANARY.iban,
      masked_pan: JSON.stringify([CANARY.pan]), balance: 0, credit_limit: 0, updated_at: 1,
    });
    await insertAccountRow(db, { id: 'jar1', kind: 'jar', currency_code: 980, title: CANARY.jarTitle, balance: 100, updated_at: 1 });
    const tx = (id: string, time: number, amount: number, mcc: number, description: string, extra: { counterName?: string; counterIban?: string; comment?: string } = {}) =>
      db.execute({
        sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount,
                currency_code, balance, comment, counter_name, counter_iban, raw_json, synced_at)
              VALUES (?, 'card1', ?, '2026-08-05', ?, ?, 0, ?, ?, 980, 0, ?, ?, ?, '{}', 1)`,
        args: [id, time, description, mcc, amount, amount, extra.comment ?? null, extra.counterName ?? null, extra.counterIban ?? null],
      });
    await tx('t1', 100, -10_000, 4829, CANARY.counterName, { counterName: CANARY.counterName, counterIban: CANARY.counterIban, comment: CANARY.comment });
    await tx('t2', 200, -5_000, 5411, CANARY.description);
    await tx('t3', 300, -700, 4829, CANARY.treasury);
    await tx('t4', 400, -300, 4829, CANARY.jarTitle);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('a full run over rows full of canaries prints none of them', async () => {
    const { report, exportError } = await rederiveAll(db, path.join(tmpDir, 'analysis.sqlite'));
    expect(exportError).toBeNull();
    const text = report.join('\n');
    expect(text).toContain('переводы людям'); // the run really happened and reported categories
    expect(text).toContain('transactions 4');
    expect(Object.values(CANARY).filter((c) => text.includes(c))).toEqual([]);
    expect(text).not.toContain('Уникальные description');
  });
});
