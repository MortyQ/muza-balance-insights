// The domain's way into statement file parsers. A bank that can be connected by a file = one entry here (and its
// providers/<id>/statement.ts); null — that bank has no file format yet.
import { monobankStatement } from './monobank/statement.ts';
import type { ProviderId, StatementFileParser } from './types.ts';

export const STATEMENT_PARSERS: Readonly<Record<ProviderId, StatementFileParser | null>> = { monobank: monobankStatement };

export function statementParserOf(provider: ProviderId): StatementFileParser | null {
  return STATEMENT_PARSERS[provider];
}
