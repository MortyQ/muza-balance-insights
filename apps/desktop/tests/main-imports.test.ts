// Main runs no query code: its run-time import graph reaches core only in shared/ and providers/ (plus the dev smoke's
// storage and the reserve limits), never the data process's code, and libsql only where the launch-time open is wired.
// The data process reaches no Electron, no network and no main or worker code. Rules: tests/helpers/main-imports.ts.
import { describe, expect, it } from 'vitest';
import { dataViolations, graph, mainViolations, readSrc, runtimeImports } from './helpers/main-imports.ts';

// A minimal legal tree: main forks the data process, wires DbAccess with libsql, reads core types only.
const legal: Array<[string, string]> = [
  [
    'main/index.ts',
    "import { app } from 'electron';\nimport dataPath from '../data/process.ts?modulePath';\nimport { openLibsql } from '@mono/db-libsql';\nimport { DataClient } from './data-client.ts';\nimport { runDbSmoke } from './smoke.ts';\nimport { RESERVE_NAME_MAX } from '../shared/allowance.ts';\n",
  ],
  ['main/data-client.ts', "import type { Db } from '@mono/core/storage/db';\nimport { type DataReply, FromData } from '../shared/data-protocol.ts';\nimport { dateIn } from '@mono/core/shared/format';\n"],
  ['main/smoke.ts', "import { migrate } from '@mono/core/storage/db';\nimport { openLibsql } from '@mono/db-libsql';\n"],
  ['shared/allowance.ts', "export { RESERVE_NAME_MAX } from '@mono/core/read/reserves';\n"],
  ['shared/data-protocol.ts', "import { z } from 'zod';\nimport { PROVIDER_IDS } from '@mono/core/providers/types';\nimport type { StatementComparison } from '@mono/core/ingest/statement-import';\n"],
  ['data/process.ts', "import { openLibsql } from '@mono/db-libsql';\nimport { DataHost } from './host.ts';\nimport { FromData } from '../shared/data-protocol.ts';\n"],
  ['data/host.ts', "import { spendingSummary } from '@mono/core/read/spending';\nimport { setAccountEnabled } from '@mono/core/commands/people';\n"],
];
const broken = (edits: Array<[string, string]>) => {
  const files = new Map([...legal, ...edits]);
  return [...mainViolations(files), ...dataViolations(files)].join('\n');
};

describe('main and data process imports', () => {
  it('the real tree has none of the violations', () => {
    const files = readSrc();
    expect(graph(files, 'main/index.ts').length).toBeGreaterThan(50);
    expect(graph(files, 'data/process.ts').some((e) => e.spec === '@mono/core/read/spending')).toBe(true);
    expect(mainViolations(files)).toEqual([]);
    expect(dataViolations(files)).toEqual([]);
  });

  it('control: the legal decoy tree passes', () => {
    expect(broken([])).toBe('');
  });

  it('type-only imports and fork targets do not count', () => {
    expect(runtimeImports("import type { A } from 'a';\nimport { type B, type C } from 'b';\nexport type { D } from 'd';")).toEqual([]);
    expect(runtimeImports("import { type B, c } from 'b';\nexport { e } from 'e';\nimport 'f';\nconst g = await import('g');")).toEqual(['b', 'e', 'f', 'g']);
    expect(graph(new Map(legal), 'main/index.ts').some((e) => e.target === 'data/process.ts')).toBe(false);
  });

  it.each([
    ['main imports a statistic', [['main/data-client.ts', "import { spendingSummary } from '@mono/core/read/spending';"]], 'main/data-client.ts: imports @mono/core/read/spending at run time'],
    ['main imports a command', [['main/data-client.ts', "import { setAccountEnabled } from '@mono/core/commands/people';"]], 'imports @mono/core/commands/people at run time'],
    ['main imports people', [['main/data-client.ts', "import { listConnections } from '@mono/core/people/participants';"]], 'imports @mono/core/people/participants at run time'],
    ['a value next to a type counts', [['main/data-client.ts', "import { type Db, migrate } from '@mono/core/storage/db';"]], 'main/data-client.ts: imports @mono/core/storage/db at run time'],
    ['a dynamic import counts', [['main/data-client.ts', "const m = await import('@mono/core/derive/rederive');"]], 'imports @mono/core/derive/rederive at run time'],
    ['through a shared file', [['shared/data-protocol.ts', "import { commitStatement } from '@mono/core/ingest/statement-import';"]], 'shared/data-protocol.ts: imports @mono/core/ingest/statement-import at run time'],
    ['the reserve limits from elsewhere', [['main/data-client.ts', "import { RESERVES_MAX } from '@mono/core/read/reserves';"]], 'main/data-client.ts: imports @mono/core/read/reserves at run time'],
    ['main runs the host itself', [['main/data-client.ts', "import { DataHost } from '../data/host.ts';"]], "main/data-client.ts: reaches the data process's code (data/host.ts)"],
    ['libsql outside the launch wiring', [['main/data-client.ts', "import { openLibsql } from '@mono/db-libsql';"]], 'main/data-client.ts: imports @mono/db-libsql'],
    ['the data process imports Electron', [['data/host.ts', "import { net } from 'electron';"]], 'data/host.ts: imports electron'],
    ['the data process reaches main', [['data/host.ts', "import { TokenVault } from '../main/token.ts';"], ['main/token.ts', '']], 'data/host.ts: reaches main/token.ts'],
    ['the data process reaches the network', [['data/host.ts', "import { allowlistedFetch } from '../net/allowlist.ts';"], ['net/allowlist.ts', '']], 'data/host.ts: reaches net/allowlist.ts'],
    ['through a shared file to the worker', [['data/host.ts', "import { x } from '../shared/x.ts';"], ['shared/x.ts', "import { run } from '../worker/run-import.ts';"], ['worker/run-import.ts', '']], 'shared/x.ts: reaches worker/run-import.ts'],
  ] as Array<[string, Array<[string, string]>, string]>)('fails: %s', (_name, edits, expected) => {
    expect(broken(edits)).toContain(expected);
  });
});
