import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ConfigError, REPO_ROOT, getToken, loadConfig } from '../src/config.ts';

describe('config', () => {
  it('missing token gives a clear error that points to .env.example', () => {
    expect(() => getToken({})).toThrow(ConfigError);
    expect(() => getToken({})).toThrow(/MONO_TOKEN не задан.*\.env\.example/);
    expect(() => getToken({ MONO_TOKEN: '   ' })).toThrow(/MONO_TOKEN не задан/);
  });

  it('returns the token when set', () => {
    expect(getToken({ MONO_TOKEN: 'secret-value' })).toBe('secret-value');
  });

  it('loadConfig does not require a token (read-only tools work without it)', () => {
    const cfg = loadConfig({});
    expect(cfg.hasToken).toBe(false);
    expect(cfg.dbPath).toBe(path.join(REPO_ROOT, 'data', 'monobank.db'));
    expect(cfg.dbUrl).toBe(`file:${cfg.dbPath}`);
  });

  it('resolves MONO_DB_PATH relative to the repository root, not cwd', () => {
    expect(loadConfig({ MONO_DB_PATH: 'x/y.db' }).dbPath).toBe(path.join(REPO_ROOT, 'x', 'y.db'));
    expect(loadConfig({ MONO_DB_PATH: '/abs/z.db' }).dbPath).toBe('/abs/z.db');
  });

  it('REPO_ROOT is the repository root (data/, .env and analysis/ stay there), not apps/mcp', () => {
    expect(path.basename(path.resolve(REPO_ROOT))).toBe('monobank-mcp');
    expect(fs.existsSync(path.join(REPO_ROOT, 'pnpm-workspace.yaml'))).toBe(true);
  });
});
