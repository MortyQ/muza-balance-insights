// The release description comes from CHANGELOG.md (scripts/release-notes.mjs, used by release.yml): the parser, the
// checks a tag must pass, and the rule of the real file — the top section is the next version, «unreleased», until the
// release bump dates it.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHANGELOG_FILE, UNRELEASED, parseChangelog, releaseNotes } from '../scripts/release-notes.mjs';

const SAMPLE = `# What's new

Intro.

## 0.2.0 — unreleased

- Coming.

## 0.1.1 — 2026-01-02

### Added

- Second.

## 0.1.0 — 2026-01-01

- First.
`;

describe('parseChangelog', () => {
  it('sections in file order with their status and body; the intro belongs to none', () => {
    expect(parseChangelog(SAMPLE)).toEqual([
      { version: '0.2.0', status: 'unreleased', body: '- Coming.' },
      { version: '0.1.1', status: '2026-01-02', body: '### Added\n\n- Second.' },
      { version: '0.1.0', status: '2026-01-01', body: '- First.' },
    ]);
  });

  it('a level-2 heading in another form is an error, not silently part of a section', () => {
    expect(() => parseChangelog('## [0.1.0] — 2026-01-01\n')).toThrow(/not in the form/);
    expect(() => parseChangelog('## Unreleased\n')).toThrow(/not in the form/);
  });
});

describe('releaseNotes', () => {
  it('a dated section → its body without the heading', () => {
    expect(releaseNotes(SAMPLE, '0.1.1')).toBe('### Added\n\n- Second.');
  });

  it('refuses: no section, still unreleased, a bad date, an empty body, the version twice', () => {
    expect(() => releaseNotes(SAMPLE, '0.3.0')).toThrow(/no section for 0\.3\.0/);
    expect(() => releaseNotes(SAMPLE, '0.2.0')).toThrow(/still "unreleased"/);
    expect(() => releaseNotes('## 0.1.0 — soon\n\n- x\n', '0.1.0')).toThrow(/expected YYYY-MM-DD/);
    expect(() => releaseNotes('## 0.1.0 — 2026-01-01\n\n\n## 0.0.9 — 2025-12-01\n- y\n', '0.1.0')).toThrow(/is empty/);
    expect(() => releaseNotes('## 0.1.0 — 2026-01-01\n- a\n## 0.1.0 — 2026-01-02\n- b\n', '0.1.0')).toThrow(/2 sections/);
  });
});

describe('the real CHANGELOG.md', () => {
  const text = fs.readFileSync(CHANGELOG_FILE, 'utf8');
  const sections = parseChangelog(text);
  const appVersion: string = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const num = (v: string) => v.split('.').map(Number) as [number, number, number];
  const cmp = (a: string, b: string) => {
    const [x, y] = [num(a), num(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  };

  it('versions are unique and newest first', () => {
    const versions = sections.map((s) => s.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect([...versions].sort((a, b) => cmp(b, a))).toEqual(versions);
  });

  it('only the top section may be unreleased; every other one is dated and has content', () => {
    for (const s of sections.slice(1)) expect(() => releaseNotes(text, s.version), s.version).not.toThrow();
    expect(sections[0]!.body).not.toBe('');
  });

  it('new work goes into the next version: the top section is the app version (dated) or a later one (unreleased)', () => {
    const top = sections[0]!;
    if (top.status === UNRELEASED) expect(cmp(top.version, appVersion)).toBeGreaterThan(0);
    else expect(top.version).toBe(appVersion);
  });
});
