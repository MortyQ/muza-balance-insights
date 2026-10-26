// Statement files in main: the system dialog picks the file, main reads it and tells its kind by the leading bytes —
// text it decodes itself, a spreadsheet or a PDF goes to the decoder process (decoder-client.ts) — then the reader the
// document picks reads it (core providers/statements.ts; another bank's reader is refused). Main keeps every account of
// the file for the next two steps — compare, write — and forgets them after them, after 10 minutes, on a new file and
// on the app lock. The renderer never gets the path, the name or the content; the log gets a code or a count only.
// The upload sheet (the data screens' «Upload statement», or files dropped on the window: their paths come from the
// preload only) takes several files at once (an upload): each account of each file goes to the connection of its
// bank that already has it, found by the data process's own match (IBAN or card number), so the renderer gets the
// connection and its person and never the number; an account no connection has waits for the user's choice of person,
// whose file connection of that bank takes it — made at the write, so a cancelled sheet leaves none behind.
import fs from 'node:fs/promises';
import { dateIn } from '@mono/core/shared/format';
import { STATEMENT_READERS, pickReader } from '@mono/core/providers/statements';
import type { ParsedStatement, ProviderId, StatementDocument } from '@mono/core/providers/types';
import type { StatementTarget } from '@mono/core/ingest/statement-import';
import { DataCallError } from '../shared/data-protocol.ts';
import { STATEMENT_ACCOUNTS_MAX } from '../shared/ipc-args.ts';
import { UPLOAD_FILES_MAX } from '../shared/upload.ts';
import type { DecodeFormat } from '../shared/decoder-protocol.ts';
import type {
  CommitStatementResult,
  CommitUploadResult,
  OpenUploadResult,
  UploadAccountView,
  UploadChoices,
  UploadFileOutcome,
  UploadFileView,
  CompareStatementResult,
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
  data: Pick<DataApi, 'connections' | 'connectionAccounts' | 'compareStatement' | 'commitStatement' | 'people' | 'createConnection'>;
  /** The system open dialog: the readers' extensions, then any file; null = cancelled. */
  pickFile: (extensions: readonly string[]) => Promise<string | null>;
  /** The same dialog with several files; [] = cancelled. */
  pickFiles: (extensions: readonly string[]) => Promise<string[]>;
  /** A spreadsheet or a PDF through the decoder process (DecoderClient.decode). */
  decode: (format: DecodeFormat, bytes: Uint8Array) => Promise<DecodeOutcome>;
  importRunning: () => boolean;
  randomId: () => string;
  nowMs: () => number;
  timeZone: () => string;
  log: (msg: string) => void;
};

type Kept = { id: string; connectionId: number; provider: ProviderId; statements: ParsedStatement[]; until: number };

/** One file of an upload: its accounts and where each one already is (null: none has it). */
type UploadFile =
  | { ok: true; provider: ProviderId; statements: ParsedStatement[]; matches: Array<{ connectionId: number; accountId: string } | null> }
  | { ok: false };

type Upload = { id: string; files: UploadFile[]; until: number };

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
  private upload: Upload | null = null;

  constructor(private readonly d: StatementsDeps) {}

  /** Drops the kept statement (the app lock, «Delete all data»). */
  forget(): void {
    this.kept = null;
    this.upload = null;
  }

  /**
   * The upload sheet's files: the dialog's (every bank's extensions, or `connectionId`'s bank's only — another bank's
   * file is then refused), or dropped paths from the preload. Files are read one at a time; one bad file is its own
   * problem, never the upload's.
   */
  async openUpload(source: { connectionId?: number; dropped?: readonly string[] } = {}): Promise<OpenUploadResult> {
    this.kept = null;
    this.upload = null;
    let expected: ProviderId | null = null;
    if (source.connectionId !== undefined) {
      const connection = (await this.d.data.connections()).find((c) => c.id === source.connectionId);
      if (!connection) throw new DataCallError('connection', 'ConnectionError', 'No such connection');
      expected = connection.provider;
    }
    let paths = source.dropped ?? null;
    if (paths === null) {
      const readers = expected === null ? Object.values(STATEMENT_READERS).flat() : STATEMENT_READERS[expected];
      paths = await this.d.pickFiles([...new Set(readers.flatMap((r) => r.extensions))]);
      if (paths.length === 0) return { opened: false, reason: 'cancelled' };
    }
    if (paths.length > UPLOAD_FILES_MAX) return { opened: false, reason: 'too-many' };

    const files: UploadFile[] = [];
    const views: UploadFileView[] = [];
    for (const file of paths) {
      const read = source.dropped && !(await isPlainFile(file)) ? ({ ok: false, problem: 'unreadable', row: null } as const) : await this.read(file, expected);
      if (!read.ok) {
        this.d.log(`[statement] ${read.problem}`);
        files.push({ ok: false });
        views.push({ ok: false, problem: read.problem, row: read.row });
        continue;
      }
      const { matches, accounts } = await this.resolve(read.provider, read.statements);
      files.push({ ok: true, provider: read.provider, statements: read.statements, matches });
      views.push({ ok: true, provider: read.provider, accounts });
    }
    const id = this.d.randomId();
    this.upload = { id, files, until: this.d.nowMs() + STATEMENT_KEEP_MS };
    this.d.log(`[statement] upload of ${files.length} files`);
    return { opened: true, uploadId: id, files: views };
  }

  /**
   * Every file whose accounts all have a place and none is blocked; the others stay unwritten with their reason. A
   * person's file connection of the bank takes the accounts no connection has (the first one; made when there is none).
   */
  async commitUpload(uploadId: string, choices: UploadChoices): Promise<CommitUploadResult> {
    const upload = this.upload;
    if (!upload || upload.id !== uploadId || this.d.nowMs() > upload.until) {
      if (upload && upload.id === uploadId) this.upload = null;
      return { written: false, reason: 'expired' };
    }
    if (choices.length !== upload.files.length) throw new Error('One choice list per file of the upload');
    if (this.d.importRunning()) return { written: false, reason: 'import-running' };

    const people = await this.d.data.people();
    const created = new Map<string, number>();
    const outcomes: UploadFileOutcome[] = [];
    let added = 0;
    for (const [i, file] of upload.files.entries()) {
      if (!file.ok) {
        outcomes.push({ written: false, reason: 'unread' });
        continue;
      }
      const chosen = choices[i]!;
      if (chosen.length !== file.statements.length) throw new Error('One choice per account of the file');
      if (file.matches.some((m, j) => m === null && chosen[j] === null)) {
        outcomes.push({ written: false, reason: 'waiting' });
        continue;
      }
      // Where each account goes: its match, or the chosen person's file connection of the bank (made once per person).
      const groups = new Map<number, { statements: ParsedStatement[]; targets: StatementTarget[] }>();
      for (const [j, statement] of file.statements.entries()) {
        const match = file.matches[j];
        let connectionId: number;
        let target: StatementTarget;
        if (match) {
          connectionId = match.connectionId;
          target = { kind: 'account', accountId: match.accountId };
        } else {
          const participantId = chosen[j]!;
          const person = people.find((p) => p.id === participantId);
          if (!person) throw new DataCallError('connection', 'ConnectionError', 'No such participant');
          const key = `${participantId}:${file.provider}`;
          const existing = person.connections.find((c) => c.provider === file.provider && c.method === 'file')?.id ?? created.get(key);
          if (existing === undefined) {
            const made = await this.d.data.createConnection({ id: participantId }, file.provider, 'file');
            created.set(key, made.connectionId);
            connectionId = made.connectionId;
          } else connectionId = existing;
          target = this.target({ kind: 'new', type: statement.account.type });
        }
        const group = groups.get(connectionId) ?? { statements: [], targets: [] };
        group.statements.push(statement);
        group.targets.push(target);
        groups.set(connectionId, group);
      }
      let fileAdded = 0;
      let blocked: UploadFileOutcome | null = null;
      for (const [connectionId, group] of groups) {
        const r = await this.d.data.commitStatement(connectionId, group.statements, group.targets);
        if (!r.written) {
          blocked = { written: false, reason: r.reason };
          break;
        }
        fileAdded += r.added;
      }
      added += fileAdded;
      outcomes.push(blocked ?? { written: true, added: fileAdded });
    }
    this.upload = null;
    this.d.log(`[statement] upload added ${added}`);
    return { written: true, added, files: outcomes };
  }

  /**
   * Each account of a file against every connection of its bank, file ones first: the first that already has it (the
   * data process's match) takes it, with its comparison; none — every row is new and the sheet asks whose it is.
   */
  private async resolve(provider: ProviderId, statements: ParsedStatement[]) {
    const people = await this.d.data.people();
    const owner = new Map(people.flatMap((p) => p.connections.map((c) => [c.id, { participantId: p.id, method: c.method }] as const)));
    const candidates = (await this.d.data.connections())
      .filter((c) => c.provider === provider)
      .sort((a, b) => (a.method === b.method ? a.id - b.id : a.method === 'file' ? -1 : 1));
    const matches: Array<{ connectionId: number; accountId: string } | null> = statements.map(() => null);
    const accounts: UploadAccountView[] = statements.map((s) => {
      const times = s.rows.map((r) => r.time);
      return {
        currencyCode: s.currencyCode,
        rows: s.rows.length,
        from: this.date(Math.min(...times)),
        to: this.date(Math.max(...times)),
        type: s.account.type,
        cardTail: cardTail(s.account.cards[0]),
        match: null,
        added: s.rows.length,
        matched: 0,
        blocked: null,
      };
    });
    for (const c of candidates) {
      const open = statements.flatMap((s, j) => (matches[j] === null ? [j] : []));
      if (open.length === 0) break;
      const found = await this.d.data.compareStatement(c.id, open.map((j) => statements[j]!), open.map(() => null));
      for (const [k, comparison] of found.entries()) {
        if (comparison.match.kind !== 'account') continue;
        const j = open[k]!;
        const who = owner.get(c.id);
        if (!who) continue;
        matches[j] = { connectionId: c.id, accountId: comparison.match.accountId };
        accounts[j] = {
          ...accounts[j]!,
          match: { connectionId: c.id, participantId: who.participantId, method: who.method },
          added: comparison.added,
          matched: comparison.matched,
          blocked: comparison.blocked,
        };
      }
    }
    return { matches, accounts };
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

  async compare(statementId: string, targets: ReadonlyArray<StatementTargetInput | null>): Promise<CompareStatementResult> {
    const kept = this.take(statementId);
    if (!kept) return { ok: false, reason: 'expired' };
    this.fits(kept, targets);
    const all = await this.d.data.compareStatement(
      kept.connectionId,
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
    const r = await this.d.data.commitStatement(kept.connectionId, kept.statements, targets.map((t) => this.target(t)));
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

  private keep(provider: ProviderId, statements: ParsedStatement[], connectionId: number): string {
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
