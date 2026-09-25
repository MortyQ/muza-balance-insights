import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MCP_ROOT, REPO_ROOT } from '../src/paths.ts';

function listTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listTs(p);
    return p.endsWith('.ts') ? [p] : [];
  });
}

describe('stdio safety', () => {
  it('no console.log / console.info / process.stdout in the server code (stdout is the MCP protocol channel)', () => {
    const dirs = [path.join(MCP_ROOT, 'src'), path.join(REPO_ROOT, 'packages', 'core', 'src'), path.join(REPO_ROOT, 'packages', 'db-libsql', 'src')];
    const files = dirs.flatMap(listTs);
    expect(files.length).toBeGreaterThan(30);
    const offenders = files.filter((f) =>
      /console\.(log|info|debug|table)\s*\(|process\.stdout/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
