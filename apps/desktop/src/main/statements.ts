// Statement files in main: the system dialog picks the file, main reads and parses it (core providers/statements.ts),
// keeps the parsed statement for the next two steps — compare with an account, write — and forgets it after them, after
// 10 minutes, on a new file and on the app lock. The renderer never gets the path, the name or the text; the log gets
// a code or a count only.
import fs from 'node:fs/promises';
import { dateIn } from '@mono/core/shared/format';
import { statementParserOf } from '@mono/core/providers/statements';
import type { ParsedStatement } from '@mono/core/providers/types';
import type { StatementTarget } from '@mono/core/ingest/statement-import';
import { DataCallError } from '../shared/data-protocol.ts';
import type {
  CommitStatementResult,
  CompareStatementResult,
  OpenStatementResult,
  StatementProblemCode,
  StatementTargetInput,
} from '../shared/api.ts';
import type { DataApi } from './data-api.ts';

/** Larger than any real statement: a year of a busy card is well under 1 MiB. */
export const STATEMENT_MAX_BYTES = 10 * 1024 * 1024;
export const STATEMENT_KEEP_MS = 10 * 60 * 1000;

export type StatementsDeps = {
  data: Pick<DataApi, 'connections' | 'connectionAccounts' | 'compareStatement' | 'commitStatement'>;
  /** The system open dialog (CSV only); null = cancelled. */
  pickFile: () => Promise<string | null>;
  importRunning: () => boolean;
  randomId: () => string;
  nowMs: () => number;
  timeZone: () => string;
  log: (msg: string) => void;
};

type Kept = { id: string; connectionId: number; statement: ParsedStatement; until: number };

/** The file's bytes, or null past the limit (checked before reading and after). */
async function readLimited(file: string): Promise<Uint8Array | null> {
  const handle = await fs.open(file, 'r');
  try {
    if ((await handle.stat()).size > STATEMENT_MAX_BYTES) return null;
    const bytes = await handle.readFile();
    return bytes.byteLength > STATEMENT_MAX_BYTES ? null : bytes;
  } finally {
    await handle.close();
  }
}

export class StatementsService {
  private kept: Kept | null = null;

  constructor(private readonly d: StatementsDeps) {}

  /** Drops the kept statement (the app lock, «Delete all data»). */
  forget(): void {
    this.kept = null;
  }

  async open(connectionId: number): Promise<OpenStatementResult> {
    this.kept = null;
    const connection = (await this.d.data.connections()).find((c) => c.id === connectionId);
    if (!connection) throw new DataCallError('connection', 'ConnectionError', 'No such connection');
    const parser = statementParserOf(connection.provider);
    if (!parser) return this.problem('no-format');

    const file = await this.d.pickFile();
    if (file === null) return { opened: false, reason: 'cancelled' };
    const bytes = await readLimited(file);
    if (bytes === null) return this.problem('too-large');
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return this.problem('unknown-format');
    }
    const parsed = parser.parse(text);
    if (!parsed.ok) return this.problem(parsed.problem, parsed.row ?? null);

    const { statement } = parsed;
    const id = this.d.randomId();
    this.kept = { id, connectionId, statement, until: this.d.nowMs() + STATEMENT_KEEP_MS };
    const accounts = (await this.d.data.connectionAccounts(connectionId)).filter((a) => a.kind === 'card' && a.currencyCode === statement.currencyCode);
    const times = statement.rows.map((r) => r.time);
    this.d.log(`[statement] opened ${statement.rows.length}`);
    return {
      opened: true,
      statementId: id,
      currencyCode: statement.currencyCode,
      rows: statement.rows.length,
      from: this.date(Math.min(...times)),
      to: this.date(Math.max(...times)),
      accounts,
    };
  }

  async compare(statementId: string, target: StatementTargetInput): Promise<CompareStatementResult> {
    const kept = this.take(statementId);
    if (!kept) return { ok: false, reason: 'expired' };
    const c = await this.d.data.compareStatement(kept.connectionId, kept.statement, this.target(target));
    return {
      ok: true,
      comparison: {
        rows: c.rows,
        matched: c.matched,
        amountDiffers: c.amountDiffers,
        added: c.added,
        missingInFile: c.missingInFile,
        gap: c.gap ? { from: this.date(c.gap.from), to: this.date(c.gap.to) } : null,
        blocked: c.blocked,
      },
    };
  }

  async commit(statementId: string, target: StatementTargetInput): Promise<CommitStatementResult> {
    const kept = this.take(statementId);
    if (!kept) return { written: false, reason: 'expired' };
    if (this.d.importRunning()) return { written: false, reason: 'import-running' };
    const r = await this.d.data.commitStatement(kept.connectionId, kept.statement, this.target(target));
    if (!r.written) return r;
    this.kept = null;
    this.d.log(`[statement] added ${r.added}`);
    return r;
  }

  private problem(problem: StatementProblemCode, row: number | null = null): OpenStatementResult {
    this.d.log(`[statement] ${problem}`);
    return { opened: false, reason: 'problem', problem, row };
  }

  /** The kept statement if it is this one and still fresh. */
  private take(statementId: string): Kept | null {
    const kept = this.kept;
    if (!kept || kept.id !== statementId) return null;
    if (this.d.nowMs() > kept.until) {
      this.kept = null;
      return null;
    }
    return kept;
  }

  private target(t: StatementTargetInput): StatementTarget {
    return t.kind === 'account' ? t : { kind: 'new', id: `file-${this.d.randomId()}`, type: t.type };
  }

  private date(sec: number): string {
    return dateIn(sec, this.d.timeZone());
  }
}
