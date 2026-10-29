// The domain's way into statement file readers. A bank that can be connected by a file = one entry here (and its
// providers/<id>/statement.ts exporting `readers`); an empty list — that bank has no file format yet.
import { readers as abankReaders } from './abank/statement.ts';
import { readers as monobankReaders } from './monobank/statement.ts';
import { readers as privatbankReaders } from './privatbank/statement.ts';
import { readers as slspReaders } from './slsp/statement.ts';
import type { ProviderId, StatementDocument, StatementReader } from './types.ts';

export const STATEMENT_READERS: Readonly<Record<ProviderId, readonly StatementReader[]>> = { monobank: monobankReaders, privatbank: privatbankReaders, abank: abankReaders, slsp: slspReaders };

const ALL_READERS: readonly StatementReader[] = Object.values(STATEMENT_READERS).flat();

export type PickResult = { ok: true; reader: StatementReader } | { ok: false; problem: 'unknown-format' | 'ambiguous' };

/**
 * The reader most sure the document is its own (detect above 0). None → `unknown-format`; two equally sure →
 * `ambiguous`. Never by the file's name or the bank the user expected.
 */
export function pickReader(doc: StatementDocument, readers: readonly StatementReader[] = ALL_READERS): PickResult {
  let best = 0;
  let picked: StatementReader[] = [];
  for (const r of readers) {
    const score = r.detect(doc);
    if (score > best) [best, picked] = [score, [r]];
    else if (score === best && score > 0) picked.push(r);
  }
  const [only, second] = picked;
  if (!only) return { ok: false, problem: 'unknown-format' };
  if (second) return { ok: false, problem: 'ambiguous' };
  return { ok: true, reader: only };
}
