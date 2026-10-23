// A statement file's write in the data process (core statement-import.ts); its comparison is core compareStatement as
// is. The file, its reading and the kept statements are main's (src/main/statements.ts); this gets the read rows only.
import type { Db } from '@mono/core/storage/db';
import type { ParsedStatement } from '@mono/core/providers/types';
import { StatementImportError, commitStatement, type StatementTarget } from '@mono/core/ingest/statement-import';
import type { StatementWriteResult } from '../shared/data-protocol.ts';

/** Every account of the file or none. A refusal (a token connection, another currency, a gap) is an answer, not an error. */
export async function writeStatement(
  db: Db,
  connectionId: number,
  statements: readonly ParsedStatement[],
  targets: readonly StatementTarget[],
  nowSec: number,
): Promise<StatementWriteResult> {
  try {
    const { added } = await commitStatement(db, connectionId, statements, targets, nowSec);
    return { written: true, added };
  } catch (err) {
    if (err instanceof StatementImportError) return { written: false, reason: err.reason };
    throw err;
  }
}
