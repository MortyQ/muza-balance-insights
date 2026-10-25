// Statement files in main: the system dialog picks the file, main reads it and tells its kind by the leading bytes —
// text it decodes itself, a spreadsheet or a PDF goes to the decoder process (decoder-client.ts) — then the reader the
// document picks reads it (core providers/statements.ts; another bank's reader is refused). Main keeps every account of
// the file for the next two steps — compare, write — and forgets them after them, after 10 minutes, on a new file and
// on the app lock. The renderer never gets the path, the name or the content; the log gets a code or a count only.
// A file may also come without a connection (the data screens' «Upload statement», or a file dropped on the window: its
// path comes from the preload only): the file names its bank, and the renderer then assigns one of that bank's
// connections before anything is compared.
import fs from 'node:fs/promises';
import { dateIn } from '@mono/core/shared/format';
import { STATEMENT_READERS, pickReader } from '@mono/core/providers/statements';
import type { ParsedStatement, ProviderId, StatementDocument } from '@mono/core/providers/types';
import type { StatementTarget } from '@mono/core/ingest/statement-import';
import { DataCallError } from '../shared/data-protocol.ts';
import { STATEMENT_ACCOUNTS_MAX } from '../shared/ipc-args.ts';
import type { DecodeFormat } from '../shared/decoder-protocol.ts';
import type {
  CommitStatementResult,
  CompareStatementResult,
  OpenAnyStatementResult,
  OpenStatementResult,
  StatementProblemCode,
  StatementTargetInput,
} from '../shared/api.ts';
import type { DataApi } from './data-api.ts';
import { sniffFormat, type DecodeError, type DecodeOutcome } from './decoder-client.ts';

/** Larger than any real statement: a year of a busy card is well under 1 MiB. */
export const STATEMENT_MAX_BYTES = 10 * 1024 * 1024;
export const STATEMENT_KEEP_MS = 10 * 60 * 1000;

export type StatementsDeps = {
  data: Pick<DataApi, 'connections' | 'connectionAccounts' | 'compareStatement' | 'commitStatement'>;
  /** The system open dialog: the readers' extensions, then any file; null = cancelled. */
  pickFile: (extensions: readonly string[]) => Promise<string | null>;
  /** A spreadsheet or a PDF through the decoder process (DecoderClient.decode). */
  decode: (format: DecodeFormat, bytes: Uint8Array) => Promise<DecodeOutcome>;
  importRunning: () => boolean;
  randomId: () => string;
  nowMs: () => number;
  timeZone: () => string;
  log: (msg: string) => void;
};

/** connectionId null: opened from the data screens, no connection assigned yet (compare and write refuse it). */
type Kept = { id: string; connectionId: number | null; provider: ProviderId; statements: ParsedStatement[]; until: number };

type Read = { ok: true; provider: ProviderId; statements: ParsedStatement[] } | { ok: false; problem: StatementProblemCode; row: number | null };

/** The decoder's refusals as the screen words them: a damaged file, a password, past the limits, too slow. */
const DECODE_PROBLEM: Readonly<Record<DecodeError, StatementProblemCode>> = {
  unreadable: 'unreadable',
  crashed: 'unreadable',
  'bad-reply': 'unreadable',
  encrypted: 'encrypted',
  'too-large': 'over-limits',
  'too-many-sheets': 'over-limits',
  'too-many-cells': 'over-limits',
  'too-many-pages': 'over-limits',
  'too-many-items': 'over-limits',
  'too-long': 'over-limits',
  timeout: 'timeout',
};

/** A regular file itself: no directory, device or symbolic link (a dropped path is checked before it is read). */
async function isPlainFile(file: string): Promise<boolean> {
  try {
    return (await fs.lstat(file)).isFile();
  } catch {
    return false;
  }
}

/** Last 4 digits of a masked card number («5375 41** **** 1234»), or null. */
const cardTail = (card: string | undefined) => (card === undefined ? null : (/(\d{4})\s*$/.exec(card)?.[1] ?? null));

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
    const readers = STATEMENT_READERS[connection.provider];
    if (readers.length === 0) return this.problem('no-format');

    const file = await this.d.pickFile([...new Set(readers.flatMap((r) => r.extensions))]);
    if (file === null) return { opened: false, reason: 'cancelled' };
    const read = await this.read(file, connection.provider);
    if (!read.ok) return this.problem(read.problem, read.row);
    const id = this.keep(read.provider, read.statements, connectionId);
    return this.view(id, connectionId, read.statements);
  }

  /** The data screens: the system dialog with every bank's statement files, or a dropped file's path (from the preload). */
  async openAny(dropped: string | null = null): Promise<OpenAnyStatementResult> {
    this.kept = null;
    let file = dropped;
    if (file === null) {
      file = await this.d.pickFile([...new Set(Object.values(STATEMENT_READERS).flatMap((rs) => rs.flatMap((r) => r.extensions)))]);
      if (file === null) return { opened: false, reason: 'cancelled' };
    } else if (!(await isPlainFile(file))) {
      return this.problem('unreadable');
    }
    const read = await this.read(file);
    if (!read.ok) return this.problem(read.problem, read.row);
    return { opened: true, statementId: this.keep(read.provider, read.statements, null), provider: read.provider };
  }

  /** A connection of the file's bank for a statement opened by openAny; then compare and write go as after open. */
  async assign(statementId: string, connectionId: number): Promise<OpenStatementResult | { opened: false; reason: 'expired' }> {
    const kept = this.take(statementId);
    if (!kept) return { opened: false, reason: 'expired' };
    const connection = (await this.d.data.connections()).find((c) => c.id === connectionId);
    if (!connection) throw new DataCallError('connection', 'ConnectionError', 'No such connection');
    if (connection.provider !== kept.provider) return this.problem('other-bank');
    kept.connectionId = connectionId;
    return this.view(kept.id, connectionId, kept.statements);
  }

  async compare(statementId: string, targets: ReadonlyArray<StatementTargetInput | null>): Promise<CompareStatementResult> {
    const kept = this.take(statementId);
    if (!kept) return { ok: false, reason: 'expired' };
    this.fits(kept, targets);
    const all = await this.d.data.compareStatement(
      this.connectionOf(kept),
      kept.statements,
      targets.map((t) => (t === null ? null : this.target(t))),
    );
    return {
      ok: true,
      comparisons: all.map((c) => ({
        match: c.match.kind === 'account' ? { kind: 'account', accountId: c.match.accountId } : { kind: 'new' },
        rows: c.rows,
        matched: c.matched,
        amountDiffers: c.amountDiffers,
        added: c.added,
        missingInFile: c.missingInFile,
        gap: c.gap ? { from: this.date(c.gap.from), to: this.date(c.gap.to) } : null,
        blocked: c.blocked,
      })),
    };
  }

  async commit(statementId: string, targets: readonly StatementTargetInput[]): Promise<CommitStatementResult> {
    const kept = this.take(statementId);
    if (!kept) return { written: false, reason: 'expired' };
    this.fits(kept, targets);
    if (this.d.importRunning()) return { written: false, reason: 'import-running' };
    const r = await this.d.data.commitStatement(this.connectionOf(kept), kept.statements, targets.map((t) => this.target(t)));
    if (!r.written) return r;
    this.kept = null;
    this.d.log(`[statement] added ${r.added}`);
    return r;
  }

  /**
   * The file's bytes → its document → the reader its content picks → one statement per account. With `expected`,
   * another bank's file is refused before its reader runs.
   */
  private async read(file: string, expected: ProviderId | null = null): Promise<Read> {
    const bytes = await readLimited(file);
    if (bytes === null) return { ok: false, problem: 'too-large', row: null };
    const doc = await this.document(bytes);
    if (!doc.ok) return { ok: false, problem: doc.problem, row: null };
    const picked = pickReader(doc.document);
    if (!picked.ok) return { ok: false, problem: picked.problem, row: null };
    if (expected !== null && picked.reader.provider !== expected) return { ok: false, problem: 'other-bank', row: null };
    const read = picked.reader.read(doc.document);
    if (!read.ok) return { ok: false, problem: read.problem, row: read.row ?? null };
    if (read.statements.length === 0) return { ok: false, problem: 'empty', row: null };
    if (read.statements.length > STATEMENT_ACCOUNTS_MAX) return { ok: false, problem: 'over-limits', row: null };
    return { ok: true, provider: picked.reader.provider, statements: read.statements };
  }

  private keep(provider: ProviderId, statements: ParsedStatement[], connectionId: number | null): string {
    const id = this.d.randomId();
    this.kept = { id, connectionId, provider, statements, until: this.d.nowMs() + STATEMENT_KEEP_MS };
    this.d.log(`[statement] opened ${statements.length} accounts, ${statements.reduce((n, s) => n + s.rows.length, 0)} rows`);
    return id;
  }

  private async view(statementId: string, connectionId: number, statements: readonly ParsedStatement[]): Promise<OpenStatementResult> {
    const cards = (await this.d.data.connectionAccounts(connectionId)).filter((a) => a.kind === 'card');
    return {
      opened: true,
      statementId,
      statements: statements.map((s) => {
        const times = s.rows.map((r) => r.time);
        return {
          currencyCode: s.currencyCode,
          rows: s.rows.length,
          from: this.date(Math.min(...times)),
          to: this.date(Math.max(...times)),
          type: s.account.type,
          cardTail: cardTail(s.account.cards[0]),
          accounts: cards.filter((a) => a.currencyCode === s.currencyCode),
        };
      }),
    };
  }

  /** Compare and write need a connection: a statement opened from the data screens gets one by assign first. */
  private connectionOf(kept: Kept): number {
    if (kept.connectionId === null) throw new Error('No connection assigned to the statement');
    return kept.connectionId;
  }

  private problem(problem: StatementProblemCode, row: number | null = null): { opened: false; reason: 'problem'; problem: StatementProblemCode; row: number | null } {
    this.d.log(`[statement] ${problem}`);
    return { opened: false, reason: 'problem', problem, row };
  }

  /** The document: text decoded here (UTF-8, a byte order mark dropped), a spreadsheet or a PDF by the decoder. */
  private async document(bytes: Uint8Array): Promise<{ ok: true; document: StatementDocument } | { ok: false; problem: StatementProblemCode }> {
    const format = sniffFormat(bytes);
    if (format !== 'text') {
      const r = await this.d.decode(format, bytes);
      return r.ok ? { ok: true, document: r.document } : { ok: false, problem: DECODE_PROBLEM[r.code] };
    }
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return { ok: true, document: { format: 'text', text: text.replace(/^\uFEFF/, '') } };
    } catch {
      return { ok: false, problem: 'unknown-format' };
    }
  }

  /** One target per account of the file; the renderer's arguments were checked for shape only. */
  private fits(kept: Kept, targets: ReadonlyArray<unknown>): void {
    if (targets.length !== kept.statements.length) throw new Error('One target per account of the file');
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
