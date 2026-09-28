// What no text may promise: the cipher (AES-256-CBC, no MAC) does not detect changes to the file, so nothing in the
// renderer, its dictionaries or the README says the data is protected against tampering.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const RENDERER = path.join(ROOT, 'apps/desktop/src/renderer/src');
const DICTIONARIES = path.join(ROOT, 'apps/desktop/src/shared/i18n');
const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e: fs.Dirent) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(vue|ts|json)$/.test(e.name) ? [p] : [];
  });

describe('no tamper-proof promise', () => {
  const PROMISE = /защищен\p{L}*\s+от\s+изменени|захищен\p{L}*\s+від\s+змін|tamper[- ]?(proof|resistant)|protected against (tampering|modification)|integrity[- ]protected/iu;

  it('renderer, dictionaries and README', () => {
    const hits = [...files(RENDERER), ...files(DICTIONARIES), path.join(ROOT, 'README.md')].filter((f) => PROMISE.test(fs.readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('the pattern catches what it is for', () => {
    expect(PROMISE.test('База защищена от изменений')).toBe(true);
    expect(PROMISE.test('База захищена від змін')).toBe(true);
    expect(PROMISE.test('the database is tamper-proof')).toBe(true);
  });
});
