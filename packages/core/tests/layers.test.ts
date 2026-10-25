// The core's folders are layers, and imports only go down: a module imports its own folder and the folders below it.
// The order, bottom up: shared → storage → providers → people → derive → read → ingest | commands. ingest and commands
// are both top: neither imports the other. Every module lives in a layer folder; nothing at the root of src/, and no
// index / utils / helpers / misc modules (imports name the module). Tests mirror the folders: a test of src/<layer>/
// lives in tests/<layer>/; the root of tests/ holds only the structure tests and the shared helpers.
// What each layer holds is in .agents/project/core-layout.md. The rules are a checker over file texts (and test
// paths), so each one is also run against a small broken tree that must fail.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { localImports, readTree, SRC, type Files } from './source-tree.ts';

const TESTS = fileURLToPath(new URL('./', import.meta.url));

const RANK: Readonly<Record<string, number>> = {
  shared: 0,
  storage: 1,
  providers: 2,
  people: 3,
  derive: 4,
  read: 5,
  ingest: 6,
  commands: 6,
};

const layerOf = (file: string): string | null => {
  const top = file.split('/')[0] ?? '';
  return file.includes('/') && top in RANK ? top : null;
};

function violations(files: Files): string[] {
  const out: string[] = [];
  for (const [file, text] of files) {
    const own = layerOf(file);
    if (own === null) {
      out.push(`${file}: not in a layer folder`);
      continue;
    }
    if (/(^|\/)(index|utils|helpers|misc)\.ts$/.test(file)) {
      out.push(`${file}: a catch-all module; name it after its job`);
    }
    for (const target of localImports(file, text)) {
      const other = layerOf(target);
      if (other === null) out.push(`${file}: imports ${target}, outside the layers`);
      else if (other !== own && RANK[other]! >= RANK[own]!) out.push(`${file}: ${own} imports ${other} (${target})`);
    }
  }
  return out;
}

/** The only files at the root of tests/: the structure tests and the shared helpers. */
const ROOT_TEST_FILES: ReadonlySet<string> = new Set([
  'purity.test.ts',
  'providers-boundary.test.ts',
  'layers.test.ts',
  'bench-generate.test.ts',
  'helpers.ts',
  'source-tree.ts',
]);

function testViolations(paths: Iterable<string>): string[] {
  const out: string[] = [];
  for (const file of paths) {
    if (!file.includes('/')) {
      if (!ROOT_TEST_FILES.has(file)) out.push(`tests/${file}: at the root of tests/; put it in tests/<layer>/`);
    } else if (layerOf(file) === null) out.push(`tests/${file}: not in a layer folder`);
  }
  return out;
}

describe('core layers', () => {
  it('the real tree has none of the violations', () => {
    const tree = readTree(SRC);
    expect(Object.keys(RANK).every((layer) => [...tree.keys()].some((f) => f.startsWith(`${layer}/`)))).toBe(true);
    expect(violations(tree)).toEqual([]);
  });

  it('the real tests/ tree mirrors the layers', () => {
    const tests = [...readTree(TESTS).keys()];
    expect(tests).toContain('derive/derived.test.ts');
    expect(testViolations(tests)).toEqual([]);
  });

  const legalTests = [...ROOT_TEST_FILES, 'read/spending.test.ts', 'providers/x/client.test.ts'];

  it.each([
    ['a module test at the root of tests/', ['spending.test.ts'], 'tests/spending.test.ts: at the root of tests/'],
    ['a test folder that is not a layer', ['stats/spending.test.ts'], 'tests/stats/spending.test.ts: not in a layer folder'],
  ])('fails: %s', (_name, paths, expected) => {
    expect(testViolations([...legalTests, ...paths]).join('\n')).toContain(expected);
  });

  it('control: the legal tests/ paths pass', () => {
    expect(testViolations(legalTests)).toEqual([]);
  });

  // A minimal legal tree: every layer imports the one below it, and a folder imports itself.
  const legal: Array<[string, string]> = [
    ['shared/format.ts', "import { TZ } from './constants.ts';"],
    ['shared/constants.ts', 'export const TZ = 1;'],
    ['storage/db.ts', "import { TZ } from '../shared/constants.ts';"],
    ['providers/types.ts', 'export type ProviderId = "x";'],
    ['providers/x/client.ts', "import type { Db } from '../../storage/db.ts';"],
    ['people/connections.ts', "import type { ProviderId } from '../providers/types.ts';"],
    ['derive/categories.ts', "import { providerOf } from '../people/connections.ts';"],
    ['read/spending.ts', "import { CATEGORY } from '../derive/categories.ts';"],
    ['ingest/sync.ts', "import { spending } from '../read/spending.ts';"],
    ['commands/people.ts', "import { rederive } from '../derive/categories.ts';"],
  ];
  const broken = (edits: Array<[string, string]>) => violations(new Map([...legal, ...edits]));

  it('control: the legal decoy tree passes', () => {
    expect(violations(new Map(legal))).toEqual([]);
  });

  it.each([
    ['a lower layer imports a higher one', [['people/connections.ts', "import { x } from '../derive/categories.ts';"]], 'people/connections.ts: people imports derive'],
    ['derive imports read', [['derive/categories.ts', "import { x } from '../read/spending.ts';"]], 'derive/categories.ts: derive imports read'],
    ['shared imports storage', [['shared/format.ts', "import type { Db } from '../storage/db.ts';"]], 'shared/format.ts: shared imports storage'],
    ['a type-only import counts too', [['storage/db.ts', "import type { P } from '../providers/types.ts';"]], 'storage/db.ts: storage imports providers'],
    ['a dynamic import counts too', [['read/spending.ts', "const m = await import('../ingest/sync.ts');"]], 'read/spending.ts: read imports ingest'],
    ['ingest imports commands', [['ingest/sync.ts', "import { x } from '../commands/people.ts';"]], 'ingest/sync.ts: ingest imports commands'],
    ['commands imports ingest', [['commands/people.ts', "import { x } from '../ingest/sync.ts';"]], 'commands/people.ts: commands imports ingest'],
    ['a module at the root of src', [['queries.ts', 'export const q = 1;']], 'queries.ts: not in a layer folder'],
    ['a folder that is not a layer', [['misc/util.ts', 'export const u = 1;']], 'misc/util.ts: not in a layer folder'],
    ['an index file', [['read/index.ts', "export * from './spending.ts';"]], 'read/index.ts: a catch-all module'],
    ['a utils module', [['derive/utils.ts', 'export const u = 1;']], 'derive/utils.ts: a catch-all module'],
    ['an import out of the layers', [['read/spending.ts', "import { q } from '../queries.ts';"]], 'read/spending.ts: imports queries.ts, outside the layers'],
  ] as Array<[string, Array<[string, string]>, string]>)('fails: %s', (_name, edits, expected) => {
    expect(broken(edits).join('\n')).toContain(expected);
  });
});
