// Bank providers stay behind their contract (src/providers/types.ts): the domain never reaches into a provider's
// folder, providers never reach into each other, and re-deriving (derive/rederive.ts) never loads a client with network
// code.
// The rules are a checker over file texts, so each one is also run against a small broken tree that must fail.
import { describe, expect, it } from 'vitest';
import { importsOf, localImports, readTree, SRC, stripComments, type Files } from './source-tree.ts';

/** `providers/<id>/…` → id; anything else → null. */
const providerOf = (file: string): string | null => /^providers\/([^/]+)\//.exec(file)?.[1] ?? null;
const isDomain = (file: string) => !file.startsWith('providers/');

/**
 * The domain's doors into providers: the contract, the rules registry, the statement parsers registry, the info registry
 * and stored ids.
 */
const DOMAIN_MAY_IMPORT = new Set(['providers/types.ts', 'providers/rules.ts', 'providers/statements.ts', 'providers/info.ts', 'providers/ids.ts']);

/**
 * Bank-specific values that must not appear in domain code (comments stripped).
 * derive/rederive.ts is exempt for «4829» only: it is part of the recategorize report text, which changes only with the
 * user's ok (CLAUDE.md).
 */
const BANK_LITERALS: ReadonlyArray<{ re: RegExp; what: string; exempt?: ReadonlyArray<string> }> = [
  { re: /\b4829\b/, what: 'MCC 4829', exempt: ['derive/rederive.ts'] },
  { re: /\b6012\b/, what: 'MCC 6012' },
  { re: /['"`]fop['"`]/, what: "account type 'fop'" },
  { re: /Від:|ГУК|З Чорної|Щомісячний/, what: 'Monobank description text' },
  { re: /monobank\.ua/i, what: 'Monobank host' },
];

function violations(files: Files): string[] {
  const out: string[] = [];
  for (const [file, text] of files) {
    const own = providerOf(file);
    for (const target of localImports(file, text)) {
      if (!target.startsWith('providers/')) continue;
      if (isDomain(file) && !DOMAIN_MAY_IMPORT.has(target)) out.push(`${file}: domain imports ${target}`);
      const other = providerOf(target);
      if (own !== null && other !== null && other !== own) out.push(`${file}: provider ${own} imports provider ${other}`);
    }
    if (file === 'providers/types.ts' && importsOf(text).length > 0) out.push(`${file}: the contract imports something`);
    if (file === 'providers/rules.ts') {
      for (const target of localImports(file, text)) {
        if (target !== 'providers/types.ts' && !/^providers\/[^/]+\/rules\.ts$/.test(target)) {
          out.push(`${file}: the rules registry imports ${target} (only <id>/rules.ts and types.ts)`);
        }
      }
    }
    if (file === 'providers/statements.ts') {
      for (const target of localImports(file, text)) {
        if (target !== 'providers/types.ts' && !/^providers\/[^/]+\/statement\.ts$/.test(target)) {
          out.push(`${file}: the statements registry imports ${target} (only <id>/statement.ts and types.ts)`);
        }
      }
    }
    if (file === 'providers/info.ts') {
      for (const target of localImports(file, text)) {
        if (target !== 'providers/types.ts' && !/^providers\/[^/]+\/info\.ts$/.test(target)) {
          out.push(`${file}: the info registry imports ${target} (only <id>/info.ts and types.ts)`);
        }
      }
    }
    if (file === 'providers/ids.ts') {
      for (const target of localImports(file, text)) {
        if (target !== 'providers/types.ts' && target !== 'providers/info.ts') {
          out.push(`${file}: stored ids import ${target} (only info.ts and types.ts)`);
        }
      }
    }
    // A bank's info is pure data (the renderer imports it): the contract and its own constants, nothing else.
    if (own !== null && file === `providers/${own}/info.ts`) {
      for (const target of localImports(file, text)) {
        if (target !== 'providers/types.ts' && target !== `providers/${own}/constants.ts`) {
          out.push(`${file}: a bank's info imports ${target} (only types.ts and its constants.ts)`);
        }
      }
    }
    if (isDomain(file)) {
      const code = stripComments(text);
      for (const l of BANK_LITERALS) if (l.re.test(code) && !l.exempt?.includes(file)) out.push(`${file}: ${l.what}`);
    }
  }
  // Re-deriving must not load a client (network code): the closure of derive/rederive.ts over relative imports.
  const seen = new Set<string>();
  const stack = files.has('derive/rederive.ts') ? ['derive/rederive.ts'] : [];
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (seen.has(f) || !files.has(f)) continue;
    seen.add(f);
    stack.push(...localImports(f, files.get(f)!));
  }
  for (const f of seen) if (/^providers\/[^/]+\/client\.ts$/.test(f)) out.push(`derive/rederive.ts reaches ${f}`);
  return out;
}

describe('provider boundary', () => {
  it('the real tree has none of the violations', () => {
    const tree = readTree(SRC);
    expect(tree.has('providers/types.ts') && tree.has('providers/monobank/client.ts') && tree.has('derive/rederive.ts')).toBe(true);
    expect(violations(tree)).toEqual([]);
  });

  // A minimal legal tree; each case below breaks exactly one rule.
  const legal: Array<[string, string]> = [
    ['providers/types.ts', 'export type ProviderId = "x";'],
    ['providers/rules.ts', "import { xRules } from './x/rules.ts';\nimport type { ProviderId } from './types.ts';"],
    ['providers/x/rules.ts', "import type { ProviderRules } from '../types.ts';\nimport { TEXTS } from './descriptions.ts';"],
    ['providers/x/descriptions.ts', 'export const TEXTS = [];'],
    ['providers/x/client.ts', "import { acquireSlot } from '../ratelimit.ts';"],
    ['providers/ratelimit.ts', 'export const acquireSlot = 1;'],
    ['providers/statements.ts', "import { xStatement } from './x/statement.ts';\nimport type { ProviderId } from './types.ts';"],
    ['providers/x/statement.ts', "import type { StatementReader } from '../types.ts';\nimport { TEXTS } from './descriptions.ts';"],
    ['providers/info.ts', "import { xInfo } from './x/info.ts';\nimport type { ProviderId } from './types.ts';"],
    ['providers/x/info.ts', "import type { ProviderInfo } from '../types.ts';\nimport { LIMIT } from './constants.ts';"],
    ['providers/x/constants.ts', 'export const LIMIT = 1;'],
    ['providers/ids.ts', "import { infoOf } from './info.ts';\nimport type { ProviderId } from './types.ts';"],
    ['categories.ts', "import { rulesFor } from './providers/rules.ts';"],
    ['plan.ts', "import { apiOf } from './providers/info.ts';"],
    ['sync.ts', "import { storedId } from './providers/ids.ts';"],
    ['statement-import.ts', "import { pickReader } from './providers/statements.ts';"],
    ['derive/rederive.ts', "import { recategorize } from '../categories.ts';"],
  ];
  const broken = (edits: Array<[string, string]>) => violations(new Map([...legal, ...edits]));

  it('control: the legal decoy tree passes', () => {
    expect(violations(new Map(legal))).toEqual([]);
  });

  it.each([
    ['domain imports a provider folder', [['categories.ts', "import { TEXTS } from './providers/x/descriptions.ts';"]], 'domain imports providers/x/descriptions.ts'],
    ['a provider imports another provider', [['providers/y/rules.ts', "import { TEXTS } from '../x/descriptions.ts';"]], 'provider y imports provider x'],
    ['the contract imports something', [['providers/types.ts', "import type { Db } from '../db.ts';"]], 'the contract imports something'],
    ['the registry imports a client', [['providers/rules.ts', "import { c } from './x/client.ts';"]], 'the rules registry imports providers/x/client.ts'],
    ['the statements registry imports a client', [['providers/statements.ts', "import { c } from './x/client.ts';"]], 'the statements registry imports providers/x/client.ts'],
    ['the info registry imports rules', [['providers/info.ts', "import { r } from './x/rules.ts';"]], 'the info registry imports providers/x/rules.ts'],
    ['stored ids import rules', [['providers/ids.ts', "import { r } from './x/rules.ts';"]], 'stored ids import providers/x/rules.ts'],
    ["a bank's info imports its client", [['providers/x/info.ts', "import { c } from './client.ts';"]], "providers/x/info.ts: a bank's info imports providers/x/client.ts"],
    ['rederive reaches a client', [['providers/x/rules.ts', "import { c } from './client.ts';"]], 'derive/rederive.ts reaches providers/x/client.ts'],
    ['MCC in the domain', [['categories.ts', 'const T = 4829;']], 'categories.ts: MCC 4829'],
    ['6012 in the domain', [['summaries.ts', 'if (mcc === 6012) {}']], 'summaries.ts: MCC 6012'],
    ["'fop' in the domain", [['scope.ts', "if (type === 'fop') {}"]], "scope.ts: account type 'fop'"],
    ['a bank text in the domain', [['search.ts', "d.startsWith('Від:')"]], 'search.ts: Monobank description text'],
    ['the bank host in the domain', [['sync.ts', "const U = 'https://api.monobank.ua';"]], 'sync.ts: Monobank host'],
  ] as Array<[string, Array<[string, string]>, string]>)('fails: %s', (_name, edits, expected) => {
    expect(broken(edits).join('\n')).toContain(expected);
  });

  it('comments do not count: explaining the Monobank rule in the domain is fine', () => {
    expect(broken([['categories.ts', "// Monobank: MCC 4829, «Від: …», type 'fop', api.monobank.ua\nexport const A = 1;"]])).toEqual([]);
  });
});
