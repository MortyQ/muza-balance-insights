// The contract every bank passes, run for each id in PROVIDER_IDS with no edit here: a new provider is covered as soon
// as it is listed. Its info is well formed, its rules answer any row (with and without an MCC or a bank category)
// within their vocabulary, its readers read its fixtures to the expected result and leave other banks' files alone,
// and its stored ids carry its prefix. Purity (no network, no file system) is the purity and boundary tests' job.
// The checks are functions returning problems, so fictional providers that break each rule must fail them.
//
// Fixtures: tests/providers/<id>/fixtures/conformance/<name>.document.json (a StatementDocument, as main hands it to
// the core) and <name>.expected.json ({ reader, result }: the reader that must pick it, and what it reads). Invented
// data only.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROVIDERS } from '../../src/providers/info.ts';
import { bankIdOf, storedId } from '../../src/providers/ids.ts';
import { monobankInfo } from '../../src/providers/monobank/info.ts';
import { monobankRules } from '../../src/providers/monobank/rules.ts';
import { PROVIDER_RULES } from '../../src/providers/rules.ts';
import { STATEMENT_READERS, pickReader } from '../../src/providers/statements.ts';
import {
  CATEGORY_HINTS,
  PROVIDER_IDS,
  type CategoryHint,
  type ProviderInfo,
  type ProviderRules,
  type RuleContext,
  type RuleTx,
  type StatementDocument,
  type StatementReadResult,
  type StatementReader,
} from '../../src/providers/types.ts';

/** A provider's parts as the checks see them: ids are plain strings, so a fictional provider fits too. */
type Info = Omit<ProviderInfo, 'id'> & { id: string };
type Rules = Omit<ProviderRules, 'id'> & { id: string };
type Reader = Omit<StatementReader, 'provider'> & { provider: string };
type Fixture = { name: string; document: StatementDocument; reader: string; result: StatementReadResult };

const INCOME_SOURCES = ['other_bank', 'named_sender', 'transfer', 'other'];
const DESC_CLASSES = ['service', 'card_pan', 'from_prefix', 'treasury', 'other'];
const CTX: RuleContext = { jarTitles: new Set(['Тестова банка']) };

function fixturesOf(provider: string): Fixture[] {
  const dir = new URL(`./${provider}/fixtures/conformance/`, import.meta.url);
  if (!fs.existsSync(dir)) return [];
  const read = (file: string): unknown => JSON.parse(fs.readFileSync(new URL(file, dir), 'utf8'));
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.document.json'))
    .sort()
    .map((f) => {
      const name = f.slice(0, -'.document.json'.length);
      const expected = read(`${name}.expected.json`) as { reader: string; result: StatementReadResult };
      return { name, document: read(f) as StatementDocument, reader: expected.reader, result: expected.result };
    });
}

function infoProblems(id: string, info: Info, readers: ReadonlyArray<Reader>): string[] {
  const out: string[] = [];
  if (info.id !== id) out.push(`${id}: info.id is ${info.id}`);
  if (info.name.trim() === '') out.push(`${id}: no name`);
  if (info.access.token === null && !info.access.file) out.push(`${id}: no way to connect`);
  if (info.ids === 'bare' && id !== 'monobank') out.push(`${id}: 'bare' ids are Monobank's only (by history); a new bank's are 'prefixed'`);
  if ('api' in info || 'api' in info.access) out.push(`${id}: api outside the token access (a bank without a token has no API)`);
  const token = info.access.token;
  if (token !== null) {
    if (!/^https:\/\/[a-z0-9.-]+$/.test(token.api.origin)) out.push(`${id}: api.origin is not https://host`);
    if (!(Number.isInteger(token.api.requestIntervalMs) && token.api.requestIntervalMs > 0)) out.push(`${id}: api.requestIntervalMs`);
    if (!(Number.isInteger(token.api.maxWindowSec) && token.api.maxWindowSec > 0)) out.push(`${id}: api.maxWindowSec`);
    if (!token.credential.source.startsWith('^') || !token.credential.source.endsWith('$')) out.push(`${id}: the credential shape is not the whole string`);
  }
  if (new Set(info.cardTypes).size !== info.cardTypes.length) out.push(`${id}: a card type twice`);
  if (info.defaultCardType !== null && !info.cardTypes.includes(info.defaultCardType)) out.push(`${id}: defaultCardType is not one of cardTypes`);
  if (info.access.file !== readers.length > 0) out.push(`${id}: access.file is ${info.access.file} with ${readers.length} readers`);
  return out;
}

/** Rows to ask the rules about: the fixtures' own, and each with and without an MCC and a bank category. */
function ruleRows(fixtures: ReadonlyArray<Fixture>): RuleTx[] {
  const read = fixtures.flatMap((f) => (f.result.ok ? f.result.statements.flatMap((s) => s.rows) : []));
  const bases = [...read.map((r) => ({ description: r.description ?? '', amount: r.amount })), { description: '', amount: -100 }, { description: 'Тест', amount: 100 }];
  return bases.flatMap((b) =>
    [null, 4829, 5411].flatMap((mcc) => [null, 'Тестова категорія'].map((bankCategory) => ({ ...b, mcc, bankCategory }))),
  );
}

function rulesProblems(id: string, rules: Rules, info: Info, rows: ReadonlyArray<RuleTx>): string[] {
  const out: string[] = [];
  if (rules.id !== id) out.push(`${id}: rules.id is ${rules.id}`);
  const ask = (what: string, tx: RuleTx | null, f: () => unknown, ok: (v: unknown) => boolean) => {
    try {
      const v = f();
      if (!ok(v)) out.push(`${id}: ${what} gave ${JSON.stringify(v)} for ${JSON.stringify(tx)}`);
    } catch (e) {
      out.push(`${id}: ${what} threw for ${JSON.stringify(tx)}: ${String(e)}`);
    }
  };
  const bool = (v: unknown) => typeof v === 'boolean';
  for (const tx of rows) {
    ask('isTransferLike', tx, () => rules.isTransferLike(tx), bool);
    ask('isOwnTransferText', tx, () => rules.isOwnTransferText(tx, CTX), bool);
    ask('isServiceTransferText', tx, () => rules.isServiceTransferText(tx, CTX), bool);
    ask('isAutoTopUp', tx, () => rules.isAutoTopUp(tx), bool);
    ask('isRefundCredit', tx, () => rules.isRefundCredit(tx), bool);
    ask('isPersonTransfer', tx, () => rules.isPersonTransfer(tx, CTX), bool);
    ask('isTreasury', tx, () => rules.isTreasury(tx.description), bool);
    if (tx.bankCategory !== null) ask('knowsBankCategory', tx, () => rules.knowsBankCategory(tx.bankCategory!), bool);
    ask('categoryHint', tx, () => rules.categoryHint(tx), (v) => v === null || (CATEGORY_HINTS as ReadonlyArray<unknown>).includes(v));
    ask('incomeSource', tx, () => rules.incomeSource(tx), (v) => INCOME_SOURCES.includes(String(v)));
    ask('namedSender', tx, () => rules.namedSender(tx.description), (v) => v === null || (typeof v === 'object' && typeof (v as { label?: unknown }).label === 'string' && typeof (v as { name?: unknown }).name === 'string'));
    ask('ownTransferCounterpart', tx, () => rules.ownTransferCounterpart(tx, CTX), (v) => {
      if (v === null) return true;
      const c = v as { kind?: unknown; title?: unknown; type?: unknown; currencyCode?: unknown };
      return (c.kind === 'jar' && typeof c.title === 'string') || (c.kind === 'card' && typeof c.type === 'string' && (c.currencyCode === null || typeof c.currencyCode === 'number'));
    });
    ask('maskDescription', tx, () => rules.maskDescription(tx.description, CTX), (v) => {
      const m = v as { description?: unknown; descClass?: unknown };
      return typeof m.description === 'string' && DESC_CLASSES.includes(String(m.descClass));
    });
  }
  for (const type of [...info.cardTypes, null]) ask('isBusinessAccount', null, () => rules.isBusinessAccount({ type }), bool);
  return out;
}

function readerProblems(id: string, readers: ReadonlyArray<Reader>, own: ReadonlyArray<Fixture>, others: ReadonlyArray<Fixture>, all: ReadonlyArray<Reader>): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const r of readers) {
    if (r.provider !== id) out.push(`${id}: reader ${r.id} belongs to ${r.provider}`);
    if (ids.has(r.id)) out.push(`${id}: reader id ${r.id} twice`);
    ids.add(r.id);
    if (r.extensions.length === 0 || r.extensions.some((e) => !/^[a-z0-9]+$/.test(e))) out.push(`${id}: reader ${r.id} extensions are not lowercase without the dot`);
    if (!own.some((f) => f.reader === r.id)) out.push(`${id}: reader ${r.id} has no fixture`);
    for (const f of others) {
      const score = r.detect(f.document);
      if (score !== 0) out.push(`${id}: reader ${r.id} claims ${f.name} of another bank (detect ${score})`);
    }
  }
  for (const f of own) {
    const reader = readers.find((r) => r.id === f.reader);
    if (!reader) {
      out.push(`${id}: fixture ${f.name} names no reader of this bank (${f.reader})`);
      continue;
    }
    // The registry's own choice, as the upload makes it: by the document alone.
    const picked = pickReader(f.document, all as ReadonlyArray<StatementReader>);
    if (!picked.ok || picked.reader.id !== f.reader) out.push(`${id}: fixture ${f.name} is not picked for ${f.reader} (${picked.ok ? picked.reader.id : picked.problem})`);
    const first = JSON.stringify(reader.read(f.document));
    if (first !== JSON.stringify(reader.read(f.document))) out.push(`${id}: ${f.reader} reads ${f.name} differently twice`);
    if (first !== JSON.stringify(f.result)) out.push(`${id}: ${f.reader} reads ${f.name} other than expected`);
    if (f.result.ok && f.result.statements.some((s) => s.rows.some((row) => 'id' in row))) out.push(`${id}: ${f.reader} sets row ids (the importer does)`);
  }
  return out;
}

const ALL_READERS: ReadonlyArray<Reader> = Object.values(STATEMENT_READERS).flat();
const ALL_FIXTURES = new Map(PROVIDER_IDS.map((p) => [p, fixturesOf(p)]));
const othersOf = (provider: string) => [...ALL_FIXTURES].filter(([p]) => p !== provider).flatMap(([, f]) => f);

describe.each(PROVIDER_IDS.map((p) => [p]))('provider %s', (provider) => {
  const info = PROVIDERS[provider];
  const readers = STATEMENT_READERS[provider];
  const fixtures = ALL_FIXTURES.get(provider) ?? [];

  it('its info is well formed; only Monobank keeps bare ids', () => {
    expect(infoProblems(provider, info, readers)).toEqual([]);
  });

  it('its stored ids carry its prefix, and give the bank its own id back', () => {
    const stored = storedId(provider, 'bank-id-1');
    expect(stored).toBe(info.ids === 'bare' ? 'bank-id-1' : `${provider}:bank-id-1`);
    expect(bankIdOf(provider, stored)).toBe('bank-id-1');
  });

  it('its rules answer any row, with and without an MCC or a bank category, in their vocabulary', () => {
    const rows = ruleRows(fixtures);
    expect(rows.length).toBeGreaterThan(6);
    expect(rulesProblems(provider, PROVIDER_RULES[provider], info, rows)).toEqual([]);
  });

  it('its readers read their fixtures as expected, twice the same, and leave other banks\' files alone', () => {
    expect(readerProblems(provider, readers, fixtures, othersOf(provider), ALL_READERS)).toEqual([]);
  });
});

describe('the checks fail a fictional provider that breaks a rule', () => {
  const fictional: Info = { ...monobankInfo, id: 'fictional', name: 'Fictional Bank', ids: 'prefixed', access: { token: null, file: true } };
  const fictionalReader: Reader = { provider: 'fictional', id: 'fictional-card', extensions: ['xlsx'], detect: () => 0, read: () => ({ ok: false, problem: 'empty' }) };
  const monobankFixtures = ALL_FIXTURES.get('monobank') ?? [];

  it('a correct fictional provider passes', () => {
    const doc: StatementDocument = { format: 'sheets', sheets: [] };
    const own: Fixture[] = [{ name: 'empty', document: doc, reader: 'fictional-card', result: { ok: false, problem: 'empty' } }];
    const reader: Reader = { ...fictionalReader, detect: (d) => (d.format === 'sheets' ? 2 : 0) };
    expect(infoProblems('fictional', fictional, [reader])).toEqual([]);
    expect(readerProblems('fictional', [reader], own, monobankFixtures, [...ALL_READERS, reader])).toEqual([]);
  });

  it("'bare' ids", () => {
    expect(infoProblems('fictional', { ...fictional, ids: 'bare' }, [fictionalReader]).join('\n')).toContain("'bare' ids are Monobank's only");
  });

  it('an API without a token', () => {
    const withApi = { ...fictional, api: monobankInfo.access.token.api };
    expect(infoProblems('fictional', withApi, [fictionalReader]).join('\n')).toContain('api outside the token access');
  });

  it('a hint outside CATEGORY_HINTS', () => {
    // The fictional rule breaks the contract on purpose: the cast is the break under test.
    const rules: Rules = { ...monobankRules, categoryHint: () => 'crypto' as CategoryHint };
    expect(rulesProblems('monobank', rules, monobankInfo, ruleRows(monobankFixtures)).join('\n')).toContain('categoryHint gave "crypto"');
  });

  it('a rule that throws on a row without an MCC', () => {
    const rules: Rules = {
      ...monobankRules,
      isRefundCredit: (tx) => {
        if (tx.mcc === null) throw new Error('no mcc');
        return false;
      },
    };
    expect(rulesProblems('monobank', rules, monobankInfo, ruleRows(monobankFixtures)).join('\n')).toContain('isRefundCredit threw');
  });

  it("a reader that claims another bank's file", () => {
    const greedy: Reader = { ...fictionalReader, detect: () => 1 };
    expect(readerProblems('fictional', [greedy], [], monobankFixtures, [...ALL_READERS, greedy]).join('\n')).toContain('claims card-uk of another bank');
  });

  it('a reader without a fixture, or one that reads differently each time', () => {
    expect(readerProblems('fictional', [fictionalReader], [], [], ALL_READERS).join('\n')).toContain('has no fixture');
    let n = 0;
    const doc: StatementDocument = { format: 'sheets', sheets: [] };
    const flaky: Reader = { ...fictionalReader, detect: (d) => (d.format === 'sheets' ? 2 : 0), read: () => ({ ok: false, problem: n++ % 2 ? 'empty' : 'bad-row' }) };
    const own: Fixture[] = [{ name: 'flaky', document: doc, reader: 'fictional-card', result: { ok: false, problem: 'bad-row' } }];
    expect(readerProblems('fictional', [flaky], own, [], [...ALL_READERS, flaky]).join('\n')).toContain('differently twice');
  });
});
