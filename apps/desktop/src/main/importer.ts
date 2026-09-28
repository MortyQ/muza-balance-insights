// Import orchestration in main: one worker (utilityProcess) per job, a job file for resume after the app is closed,
// powerSaveBlocker while it runs, progress forwarded to the renderer after validation. Main closes the worker once its
// final message arrives; a worker that dies without one is restarted on the shared retry policy (src/shared/retry.ts).
// All connections import in one job (one worker, one job file). Tokens go to the worker in the `start` message only;
// nothing sent to the renderer or logged can contain them. A connection without a token is skipped and reported.
// «Автосинхронизация» (startAuto) is the same run, quieter: no job file, no token prompts, every state marked `auto`, and a
// user's start replaces it.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { kyivStartOfDay, toKyivDate } from '@mono/core/format';
import type { ProviderId } from '@mono/core/providers/types';
import { FromWorker, StartMessage, type ToWorker } from '../shared/import-protocol.ts';
import type { ImportDepth, ImportFailure, ImportProgress, StartImportResult } from '../shared/progress.ts';
import { nextRetryDelay, sleptDuringPause } from '../shared/retry.ts';

export const JOB_FILE = 'import-job.json';
export const CANCEL_KILL_MS = 10_000;

/** Start of the Kyiv day `depth` months before today (day clamped: 31 Mar − 1 month = 28/29 Feb). */
export function sinceForDepth(depth: ImportDepth, nowSec: number): number {
  const [y, m, d] = toKyivDate(nowSec).split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) - depth;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const td = Math.min(d, lastDay);
  return kyivStartOfDay(`${ty}-${String(tm).padStart(2, '0')}-${String(td).padStart(2, '0')}`);
}

const JobSchema = z.strictObject({ sinceSec: z.number().int().positive(), depth: z.number().int(), startedAt: z.number().int() });
type Job = z.infer<typeof JobSchema> & { auto?: true };

export type ChildLike = {
  postMessage(msg: ToWorker): void;
  kill(): boolean;
  on(event: 'message', listener: (msg: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
};

export type ImporterDeps = {
  fork: () => ChildLike;
  /** Every connection, in order. */
  connections: () => Promise<ReadonlyArray<{ connectionId: number; provider: ProviderId }>>;
  tokens: {
    get(connectionId: number): Promise<string | null>;
    status(connectionId: number): Promise<{ stored: 'secure' | 'memory' | null }>;
  };
  powerSaveBlocker: { start(type: 'prevent-app-suspension'): number; stop(id: number): void };
  userDataDir: string;
  /** The database for the worker (DbAccess.forWorker): its path and key; null while the database is unavailable. */
  db: () => { dbPath: string; dbKey: string | null } | null;
  nowSec: () => number;
  /** To the renderer (PROGRESS_CHANNEL). */
  send: (p: ImportProgress) => void;
  /** Main log: service lines only. */
  log: (msg: string) => void;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (t: unknown) => void;
};

export class Importer {
  private child: ChildLike | null = null;
  private blocker: number | null = null;
  private killTimer: unknown = null;
  private restartTimer: unknown = null;
  private cancelling = false;
  private shuttingDown = false;
  private stopping = false;
  private childExit: Promise<void> | null = null;
  // Current streak of worker crashes; a committed window (or done) ends it.
  private crashSince: number | null = null;
  private crashAttempt = 0;
  private last: ImportProgress = { phase: 'idle' };
  // The job of the latest launch (a restart keeps it).
  private current: Job | null = null;
  private readonly jobFile: string;

  constructor(private readonly d: ImporterDeps) {
    this.jobFile = path.join(d.userDataDir, JOB_FILE);
  }

  /** A worker is at work, or a crashed one is due to restart. */
  get running(): boolean {
    return this.child !== null || this.restartTimer !== null;
  }

  /** The latest state, re-sent when the renderer (re)loads. */
  get lastProgress(): ImportProgress {
    return this.last;
  }

  /** An automatic refresh is at work (or due to restart). */
  get autoRunning(): boolean {
    return this.running && this.current?.auto === true;
  }

  /** A user's import. An automatic refresh in progress is stopped first: this plan covers its windows too. */
  async start(depth: ImportDepth): Promise<StartImportResult> {
    if (this.autoRunning) {
      this.d.log('import: auto refresh replaced by a user import');
      await this.halt();
    }
    return this.launch({ sinceSec: sinceForDepth(depth, this.d.nowSec()), depth, startedAt: this.d.nowSec() }, false);
  }

  /**
   * «Автосинхронизация»: every connection with a token, from the start of this Kyiv month, each covered account re-reading
   * one whole window up to now. Not while an import runs or an unfinished one waits to resume. Writes no job file
   * (the next launch refreshes again) and asks for no token: a connection without one is left to the home notice.
   */
  async startAuto(): Promise<StartImportResult> {
    if (this.running) return { started: false, reason: 'running' };
    if (this.readJob()) return { started: false, reason: 'running' };
    const now = this.d.nowSec();
    return this.launch({ sinceSec: kyivStartOfDay(`${toKyivDate(now).slice(0, 8)}01`), depth: 0, startedAt: now, auto: true }, false);
  }

  /**
   * On launch: an unfinished job resumes by itself for the connections whose token is in secure storage (the rest are
   * reported as skipped); with none, the UI asks for the tokens.
   */
  async resumeOnLaunch(): Promise<void> {
    const job = this.readJob();
    if (!job || this.running || !this.d.db()) return;
    const all = await this.d.connections();
    const secure: number[] = [];
    for (const c of all) if ((await this.d.tokens.status(c.connectionId)).stored === 'secure') secure.push(c.connectionId);
    if (secure.length === 0) {
      this.emit({ phase: 'needs-token', connectionIds: all.map((c) => c.connectionId) });
      return;
    }
    await this.launch(job, true, secure);
  }

  /** Cooperative cancel; the worker is killed if it hasn't exited within CANCEL_KILL_MS. */
  cancel(): void {
    if (this.restartTimer !== null) {
      this.clearRestart();
      this.resetCrashes();
      this.removeJob();
      this.emit({ phase: 'cancelled' }, this.current);
      return;
    }
    if (!this.child || this.cancelling) return;
    this.cancelling = true;
    this.child.postMessage({ type: 'cancel' });
    const set = this.d.setTimeout ?? setTimeout;
    this.killTimer = set(() => {
      this.d.log('import: worker did not stop in time, killing it');
      this.child?.kill();
    }, CANCEL_KILL_MS);
  }

  /**
   * «Удалить все данные»: stop now — no cooperative cancel, no restart — and wait until the worker has exited,
   * so nothing holds the database open. The job is dropped.
   */
  async stop(): Promise<void> {
    await this.halt();
    this.current = null;
    this.removeJob();
    this.emit({ phase: 'idle' });
  }

  /** App quit: stop the worker, keep the job file (the import resumes next launch). */
  shutdown(): void {
    this.shuttingDown = true;
    this.clearRestart();
    this.child?.kill();
  }

  /** Kill the worker (no cooperative cancel, no restart) and wait for its exit; the job file stays as it is. */
  private async halt(): Promise<void> {
    this.clearRestart();
    this.resetCrashes();
    const child = this.child;
    const exit = this.childExit;
    if (child) {
      this.stopping = true;
      child.kill();
      await exit;
      this.stopping = false;
    }
  }

  /** `only`: the connections to take (resume on launch: those with a saved token); absent — every connection. */
  private async launch(job: Job, resumed: boolean, only?: readonly number[]): Promise<StartImportResult> {
    if (this.running) return { started: false, reason: 'running' };
    // Read at every launch (a restart after a crash too): the state may have changed since.
    const target = this.d.db();
    if (!target) return { started: false, reason: 'db-unavailable' };
    const all = await this.d.connections();
    const connections: Array<{ connectionId: number; provider: ProviderId; token: string }> = [];
    for (const c of all) {
      if (only && !only.includes(c.connectionId)) continue;
      const token = await this.d.tokens.get(c.connectionId);
      if (token) connections.push({ ...c, token });
    }
    const skipped = all.filter((c) => !connections.some((x) => x.connectionId === c.connectionId)).map((c) => c.connectionId);
    if (connections.length === 0) {
      if (resumed && !job.auto) this.emit({ phase: 'needs-token', connectionIds: skipped });
      return { started: false, reason: 'no-token' };
    }
    // Checked before anything starts: a start the worker would drop must not leave a job and a blocker behind.
    const start = StartMessage.safeParse({ type: 'start', dbPath: target.dbPath, dbKey: target.dbKey, connections,
      sinceSec: job.sinceSec,
      rereadWindow: job.auto === true,
    });
    if (!start.success) {
      this.d.log('import: start message rejected');
      return { started: false, reason: 'db-unavailable' };
    }
    this.current = job;
    if (!job.auto) this.writeJob(job);
    this.cancelling = false;
    this.blocker = this.d.powerSaveBlocker.start('prevent-app-suspension');
    const child = this.d.fork();
    this.child = child;
    let finished = false;
    let exited = false;
    let onExit: () => void = () => undefined;
    this.childExit = new Promise<void>((resolve) => (onExit = resolve));
    child.on('message', (raw) => {
      if (finished) return;
      const parsed = FromWorker.safeParse(raw);
      if (!parsed.success) {
        this.d.log('import: dropped a malformed worker message');
        return;
      }
      const msg = parsed.data;
      if (msg.type === 'progress') {
        if (msg.progress.phase === 'windows' && msg.progress.windowsDone > 0) this.resetCrashes();
        this.emit(msg.progress, job);
        return;
      }
      if (msg.type === 'log') {
        this.d.log(`import: ${msg.message}`);
        return;
      }
      finished = true;
      if (msg.type === 'done') {
        this.resetCrashes();
        this.removeJob();
        const failed: ImportFailure[] = [
          ...msg.failed.map(({ connectionId, kind }) => ({ connectionId, error: kind })),
          ...(job.auto ? [] : skipped.map((connectionId) => ({ connectionId, error: 'no-token' as const }))),
        ];
        this.emit({ phase: 'done', windowsTotal: msg.windowsTotal, transactions: msg.transactions, failed }, job);
      } else if (msg.kind === 'cancelled') {
        // A user cancel ends the job; any other error keeps it for the next launch.
        this.removeJob();
        this.emit({ phase: 'cancelled' }, job);
      } else {
        this.emit({ phase: 'error', error: msg.kind }, job);
      }
      // The final message is in: nothing else is expected, so main closes the worker itself.
      child.kill();
    });
    child.on('exit', (code) => {
      if (exited) return;
      exited = true;
      this.d.log(`import: worker exit code=${code}`);
      if (this.child === child) (this.child = null), (this.childExit = null);
      onExit();
      this.stopBlocker();
      if (this.killTimer !== null) (this.d.clearTimeout ?? clearTimeout)(this.killTimer as ReturnType<typeof setTimeout>);
      this.killTimer = null;
      if (finished || this.shuttingDown || this.stopping) return;
      if (this.cancelling) {
        this.removeJob();
        this.emit({ phase: 'cancelled' }, job);
        return;
      }
      this.scheduleRestart(job);
    });
    this.emit({ phase: 'starting', resumed }, job);
    child.postMessage(start.data);
    return { started: true };
  }

  /** A worker died without a final message: restart it with the same job, or give up after the retry budget. */
  private scheduleRestart(job: Job): void {
    const now = this.d.nowSec() * 1000;
    this.crashSince ??= now;
    this.crashAttempt += 1;
    const delay = nextRetryDelay(this.crashSince, now, this.crashAttempt);
    if (delay === null) {
      this.resetCrashes();
      this.emit({ phase: 'error', error: 'crash' }, job);
      return;
    }
    this.d.log(`import: worker died, restart ${this.crashAttempt} in ${delay / 1000} s`);
    this.emit({ phase: 'retry', reason: 'crash', attempt: this.crashAttempt, inSec: delay / 1000 }, job);
    const pauseStart = this.d.nowSec() * 1000;
    this.restartTimer = (this.d.setTimeout ?? setTimeout)(() => {
      this.restartTimer = null;
      // Time the Mac slept through the pause does not count towards the retry budget.
      const slept = sleptDuringPause(pauseStart, this.d.nowSec() * 1000, delay);
      if (slept > 0 && this.crashSince !== null) this.crashSince += slept;
      void this.launch(job, true);
    }, delay);
  }

  private clearRestart(): void {
    if (this.restartTimer !== null) (this.d.clearTimeout ?? clearTimeout)(this.restartTimer as ReturnType<typeof setTimeout>);
    this.restartTimer = null;
  }

  private resetCrashes(): void {
    this.crashSince = null;
    this.crashAttempt = 0;
  }

  /** `job`: the run this state belongs to — an automatic one marks it `auto`. */
  private emit(p: ImportProgress, job?: Job | null): void {
    const view: ImportProgress = job?.auto ? { ...p, auto: true } : p;
    this.last = view;
    this.d.send(view);
  }

  private stopBlocker(): void {
    if (this.blocker !== null) this.d.powerSaveBlocker.stop(this.blocker);
    this.blocker = null;
  }

  private readJob(): Job | null {
    try {
      const parsed = JobSchema.safeParse(JSON.parse(fs.readFileSync(this.jobFile, 'utf8')));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private writeJob(job: Job): void {
    fs.mkdirSync(path.dirname(this.jobFile), { recursive: true });
    fs.writeFileSync(this.jobFile, JSON.stringify(job));
  }

  /** An automatic run never wrote the file: whatever is there belongs to a user's import. */
  private removeJob(): void {
    if (this.current?.auto) return;
    fs.rmSync(this.jobFile, { force: true });
  }
}
