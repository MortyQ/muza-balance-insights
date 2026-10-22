// A statement file's comparison and write in the data process (core statement-import.ts). The file, its reading and the
// kept statement are main's (src/main/statements.ts); this gets the read rows only. Main keeps one statement per upload
// for now: the core takes the whole file, here a file of that one statement.
import type { Db } from '@mono/core/storage/db';
import type { ParsedStatement } from '@mono/core/providers/types';
import {
  StatementImportError,
  commitStatement,
  compareStatement,
  type StatementComparison,
  type StatementTarget,
} from '@mono/core/ingest/statement-import';
import type { StatementWriteResult } from '../shared/data-protocol.ts';

export async function compareOne(db: Db, connectionId: number, statement: ParsedStatement, target: StatementTarget): Promise<StatementComparison> {
  const [comparison] = await compareStatement(db, connectionId, [statement], [target]);
  if (!comparison) throw new Error('No comparison for the statement');
  return comparison;
}

/** A refusal (a token connection, another currency, a gap) is an answer, not an error. */
export async function writeStatement(db: Db, connectionId: number, statement: ParsedStatement, target: StatementTarget, nowSec: number): Promise<StatementWriteResult> {
  try {
    const { added } = await commitStatement(db, connectionId, [statement], [target], nowSec);
    return { written: true, added };
  } catch (err) {
    if (err instanceof StatementImportError) return { written: false, reason: err.reason };
    throw err;
  }
}
