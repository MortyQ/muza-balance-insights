// How pnpm hands arguments to our CLI scripts, checked on the real pnpm rather than taken on faith:
// `pnpm <script> -- a b` and `pnpm <script> a b` must mean the same to every CLI.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cliArgs } from '../src/args.ts';
import { MCP_ROOT, REPO_ROOT } from '../src/paths.ts';

const ARGS = ['--since', '2026-01-01', '--account', 'acc-1', 'two words'];

function pnpm(cwd: string, args: string[]) {
  const r = spawnSync('pnpm', args, { cwd, encoding: 'utf8', timeout: 60_000, env: { ...process.env, NO_COLOR: '1' } });
  if (r.error) throw r.error;
  return r;
}

function probe(cwd: string, args: string[]): string[] {
  const r = pnpm(cwd, args);
  const line = r.stdout.split('\n').find((l) => l.startsWith('ARGV '));
  if (!line) throw new Error(`pnpm ${args.join(' ')}: нет вывода пробы (status ${r.status}): ${r.stderr}`);
  return JSON.parse(line.slice('ARGV '.length));
}

describe('cliArgs', () => {
  it('drops one leading `--` and nothing else', () => {
    expect(cliArgs(['--', '--since', 'x'])).toEqual(['--since', 'x']);
    expect(cliArgs(['--since', 'x'])).toEqual(['--since', 'x']);
    expect(cliArgs(['a', '--', 'b'])).toEqual(['a', '--', 'b']);
    expect(cliArgs([])).toEqual([]);
  });
});

describe('pnpm → script arguments (real pnpm)', () => {
  const forms: Array<[string, string, string[]]> = [
    ['pnpm --filter @mono/mcp <s>', REPO_ROOT, ['--filter', '@mono/mcp']],
    ['pnpm -C apps/mcp <s>', REPO_ROOT, ['-C', 'apps/mcp']],
    ['pnpm <s> (in apps/mcp)', MCP_ROOT, []],
  ];

  it.each(forms)('%s: with and without `--` the CLI sees the same arguments', (_, cwd, prefix) => {
    const withDash = probe(cwd, [...prefix, 'argv-probe', '--', ...ARGS]);
    const without = probe(cwd, [...prefix, 'argv-probe', ...ARGS]);
    expect(cliArgs(withDash)).toEqual(ARGS);
    expect(cliArgs(without)).toEqual(ARGS);
  }, 120_000);

  it.each(forms)('%s: a script with a built-in subcommand (overrides:add shape)', (_, cwd, prefix) => {
    for (const dash of [['--'], []]) {
      const [command, ...rest] = probe(cwd, [...prefix, 'argv-probe:cmd', ...dash, ...ARGS]);
      expect(command).toBe('add');
      expect(cliArgs(rest)).toEqual(ARGS);
    }
  }, 120_000);

  it('root `pnpm q <file>`: with and without `--` q gets the file (a missing one is rejected before any database)', () => {
    for (const dash of [['--'], []]) {
      const r = pnpm(REPO_ROOT, ['q', ...dash, 'analysis/queries/__argv_probe_missing__.sql']);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('Файл не найден: analysis/queries/__argv_probe_missing__.sql');
    }
  }, 120_000);
});

describe('tsx loads TypeScript from workspace packages (package exports → .ts)', () => {
  it('node --import tsx: @mono/core/<module> and @mono/db-libsql resolve and run', () => {
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'tests/fixtures/workspace-import.ts'], { cwd: MCP_ROOT, encoding: 'utf8', timeout: 60_000 });
    const line = r.stdout.split('\n').find((l) => l.startsWith('WS '));
    expect(line, r.stderr).toBeDefined();
    expect(JSON.parse(line!.slice(3))).toEqual({ uah: 'UAH', schema: expect.any(Number), n: 42 });
  });
});

describe('the probe is representative', () => {
  it('every CLI script is launched exactly like the probe: `node --import tsx <file>` (no tsx CLI, no extra layer)', () => {
    const scripts: Record<string, string> = JSON.parse(fs.readFileSync(path.join(MCP_ROOT, 'package.json'), 'utf8')).scripts;
    const launched = Object.entries(scripts)
      .filter(([k]) => k !== 'test' && k !== 'typecheck')
      .map(([k, v]) => [k, k === 'recategorize' ? v.split(' && ').at(-1)! : v] as const);
    expect(launched.length).toBeGreaterThan(15);
    expect(launched.filter(([, v]) => !/^node --import tsx [\w./-]+\.ts( [a-z]+)?$/.test(v))).toEqual([]);
    const root = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).scripts;
    expect(root.q).toBe('node --import tsx apps/mcp/scripts/q.ts');
  });
});

describe('every CLI reads its arguments through cliArgs', () => {
  const files = [
    ...fs.readdirSync(path.join(MCP_ROOT, 'src', 'cli')).map((f) => path.join(MCP_ROOT, 'src', 'cli', f)),
    ...fs.readdirSync(path.join(MCP_ROOT, 'scripts')).map((f) => path.join(MCP_ROOT, 'scripts', f)),
  ].filter((f) => f.endsWith('.ts'));

  it('process.argv / parseArgs only together with cliArgs; parseArgs gets args: cliArgs()', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const code = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      const readsArgs = /process\.argv|parseArgs\(/.test(code);
      if (!readsArgs) continue;
      const ok =
        /cliArgs\(/.test(code) &&
        (!/parseArgs\(/.test(code) || /parseArgs\(\{\s*args: cliArgs\(\)/.test(code)) &&
        // A subcommand split keeps the rest for cliArgs: `const [command, ...rest] = process.argv.slice(2); cliArgs(rest)`.
        (!/process\.argv/.test(code) || /cliArgs\(rest\)/.test(code));
      if (!ok) offenders.push(path.relative(MCP_ROOT, f));
    }
    expect(files.length).toBeGreaterThan(5);
    expect(offenders).toEqual([]);
  });
});
