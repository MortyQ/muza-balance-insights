// .github/workflows/release.yml is a trust anchor (CLAUDE.md): it builds and publishes under the author's name.
// Its guarantees as text checks, so an edit that drops one fails here: actions pinned by commit SHA, no permissions
// by default and writes only in the release job, no pull-request triggers, no secrets, no ${{ github.event.* }}
// inside shell code, a draft release only, installers that never publish by themselves.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const wf = fs.readFileSync(fileURLToPath(new URL('../../../.github/workflows/release.yml', import.meta.url)), 'utf8');
const code = wf.replace(/^\s*#.*$/gm, '');

/** Top-level job names → their text (jobs are the 2-space-indented keys under `jobs:`). */
function jobs(): Record<string, string> {
  const body = code.slice(code.indexOf('\njobs:\n') + 7);
  const out: Record<string, string> = {};
  const parts = body.split(/\n(?=  [a-z][\w-]*:\n)/);
  for (const p of parts) {
    const m = /^\s*([a-z][\w-]*):\n/.exec(p);
    if (m) out[m[1]!] = p;
  }
  return out;
}

describe('release workflow', () => {
  it('triggers: a v* tag push and a manual run — nothing for pull requests, pushes to branches or schedules', () => {
    const on = /\non:\n([\s\S]*?)\n\S/.exec(code)![1]!;
    expect(on).toMatch(/push:\n\s+tags: \['v\*'\]/);
    expect(on).toContain('workflow_dispatch:');
    expect(on).not.toMatch(/pull_request|branches:|schedule:|workflow_run:|issue/);
  });

  it('every action is pinned to a full commit SHA with its version as a comment', () => {
    const uses = [...wf.matchAll(/uses:\s*(\S+)(.*)$/gm)].map((m) => [m[1]!, m[2]!]);
    expect(uses.length).toBeGreaterThanOrEqual(5);
    for (const [ref, comment] of uses) {
      expect(ref, ref).toMatch(/^actions\/[\w-]+@[0-9a-f]{40}$/);
      expect(comment, ref).toMatch(/# v\d+\.\d+\.\d+$/);
    }
  });

  it('no permissions by default; read-only jobs; writes (release, attestations) only in the release job, only on a tag', () => {
    expect(code).toMatch(/\npermissions: \{\}\n/);
    const j = jobs();
    expect(Object.keys(j).sort()).toEqual(['build', 'release', 'test']);
    for (const name of ['test', 'build']) {
      expect(j[name]).toMatch(/permissions:\n\s+contents: read\n/);
      expect(j[name]).not.toMatch(/: write/);
    }
    expect(j.release).toMatch(/if: startsWith\(github\.ref, 'refs\/tags\/v'\)/);
    const writes = [...j.release!.matchAll(/^\s+([\w-]+): write/gm)].map((m) => m[1]).sort();
    expect(writes).toEqual(['attestations', 'contents', 'id-token']);
  });

  it('no secrets; the only token is the job’s own, and only for gh in the release step', () => {
    expect(code).not.toMatch(/secrets\./);
    expect([...code.matchAll(/github\.token/g)]).toHaveLength(1);
    expect(jobs().release).toContain('GH_TOKEN: ${{ github.token }}');
  });

  it('no ${{ … }} from event data inside shell code (script injection): run steps use env vars like $GITHUB_REF_NAME', () => {
    expect(code).not.toMatch(/\$\{\{\s*github\.(event|head_ref)/);
    const runs = [...code.matchAll(/run: \|\n((?:\s{10}.*\n?)+)|run: (.+)$/gm)].map((m) => m[1] ?? m[2] ?? '');
    for (const r of runs) expect(r.replace(/\$\{\{ matrix\.target \}\}/g, ''), r).not.toContain('${{');
  });

  it('checkout never keeps the token in .git; installs from the lockfile only', () => {
    const checkouts = [...code.matchAll(/uses: actions\/checkout@\S+.*\n\s+with:\n\s+persist-credentials: false/g)];
    expect(checkouts).toHaveLength(2);
    expect([...code.matchAll(/pnpm install --frozen-lockfile/g)]).toHaveLength(2);
    expect(code).not.toMatch(/pnpm install(?! --frozen-lockfile)/);
  });

  it('builds with the package scripts (they carry --publish never) and checks the result before upload', () => {
    const b = jobs().build!;
    expect(b).toContain('pnpm --filter @mono/desktop run package:${{ matrix.target }}');
    expect(b).toMatch(/PACKAGE_CHECK: '1'\n\s+run: pnpm --filter @mono\/desktop exec vitest run tests\/package\.test\.ts/);
    expect(b).toMatch(/DMG_CHECK: '1'\n\s+run: pnpm --filter @mono\/desktop exec vitest run tests\/dmg\.test\.ts/);
    expect(b.indexOf('tests/package.test.ts')).toBeLessThan(b.indexOf('upload-artifact'));
    expect(code).not.toMatch(/electron-builder/);
  });

  it('the release is a draft, for an existing tag, with SHA256SUMS.txt and provenance attestations of every installer', () => {
    const r = jobs().release!;
    expect(r).toContain('--draft');
    expect(r).toContain('--verify-tag');
    expect(r).toContain('sha256sum Balance-Insights-* > SHA256SUMS.txt');
    expect(r).toMatch(/attest-build-provenance@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+subject-path: dist\/Balance-Insights-\*/);
    expect(r.indexOf('attest-build-provenance')).toBeLessThan(r.indexOf('gh release create'));
  });

  it('the tag must match the app version, before anything is built', () => {
    const t = jobs().test!;
    expect(t).toContain('if [ "v$version" != "$GITHUB_REF_NAME" ]; then');
    expect(jobs().build).toMatch(/needs: test/);
  });
});
