// Bank providers stay behind their contract (src/providers/types.ts): the domain never reaches into a provider's
// folder, providers never reach into each other, and re-deriving (rederive.ts) never loads a client with network code.
// The rules are a checker over file texts, so each one is also run against a small broken tree that must fail.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

type Files = ReadonlyMap<string, string>; // posix path relative to src/ → text

// `//` after `:` is a URL (https://…), not a comment.
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|(?<!:)\/\/.*$/gm, '');

function importsOf(text: string): string[] {
  const out: string[] = [];
  for (const re of [/(?:^|\s)(?:import|export)\s[^'";]*?\sfrom\s*['"]([^'"]+)['"]/g, /(?:^|\s)import\s*['"]([^'"]+)['"]/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g]) {
    for (const m of stripComments(text).matchAll(re)) if (m[1]) out.push(m[1]);
  }
  return out;
}

/** Relative imports of `file`, resolved to paths relative to src/. */
function localImports(file: string, text: string): string[] {
  return importsOf(text)
    .filter((s) => s.startsWith('.'))
    .map((s) => path.posix.normalize(path.posix.join(path.posix.dirname(file), s)));
}

/** `providers/<id>/…` → id; anything else → null. */
const providerOf = (file: string): string | null => /^providers\/([^/]+)\//.exec(file)?.[1] ?? null;
const isDomain = (file: string) => !file.startsWith('providers/');

/** The domain's two doors into providers: the contract and the rules registry. */
const DOMAIN_MAY_IMPORT = new Set(['providers/types.ts', 'providers/rules.ts']);

/**
 * Bank-specific values that must not appear in domain code (comments stripped).
 * rederive.ts is exempt for «4829» only: it is part of the recategorize report text, which changes only with the
 * user's ok (CLAUDE.md).
 */
const BANK_LITERALS: ReadonlyArray<{ re: RegExp; what: string; exempt?: ReadonlyArray<string> }> = [
  { re: /\b4829\b/, what: 'MCC 4829', exempt: ['rederive.ts'] },
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
    if (isDomain(file)) {
      const code = stripComments(text);
      for (const l of BANK_LITERALS) if (l.re.test(code) && !l.exempt?.includes(file)) out.push(`${file}: ${l.what}`);
    }
  }
  // Re-deriving must not load a client (network code): the closure of rederive.ts over relative imports.
  const seen = new Set<string>();
  const stack = files.has('rederive.ts') ? ['rederive.ts'] : [];
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (seen.has(f) || !files.has(f)) continue;
    seen.add(f);
    stack.push(...localImports(f, files.get(f)!));
  }
  for (const f of seen) if (/^providers\/[^/]+\/client\.ts$/.test(f)) out.push(`rederive.ts reaches ${f}`);
  return out;
}

function readTree(dir: string, base = dir): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) for (const [k, v] of readTree(p, base)) out.set(k, v);
    else if (e.name.endsWith('.ts')) out.set(path.relative(base, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8'));
  }
  return out;
}

describe('provider boundary', () => {
  it('the real tree has none of the violations', () => {
    const tree = readTree(SRC);
    expect(tree.has('providers/types.ts') && tree.has('providers/monobank/client.ts') && tree.has('rederive.ts')).toBe(true);
    expect(violations(tree)).toEqual([]);
  });

  // A minimal legal tree; each case below breaks exactly one rule.
  const legal: Array<[string, string]> = [
    ['providers/types.ts', 'export type ProviderId = "x";'],
    ['providers/rules.ts', "import { xRules } from './x/rules.ts';\nimport type { ProviderId } from './types.ts';"],
    ['providers/x/rules.ts', "import type { ProviderRules } from '../types.ts';\nimport { TEXTS } from './descriptions.ts';"],
    ['providers/x/descriptions.ts', 'export const TEXTS = [];'],
    ['providers/x/client.ts', "import { acquireSlot } from '../../ratelimit.ts';"],
    ['ratelimit.ts', 'export const acquireSlot = 1;'],
    ['categories.ts', "import { rulesFor } from './providers/rules.ts';"],
    ['rederive.ts', "import { recategorize } from './categories.ts';"],
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
    ['rederive reaches a client', [['providers/x/rules.ts', "import { c } from './client.ts';"]], 'rederive.ts reaches providers/x/client.ts'],
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
