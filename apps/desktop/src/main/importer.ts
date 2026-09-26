// Import orchestration in main: one worker (utilityProcess) per job, a job file for resume after the app is closed,
// powerSaveBlocker while it runs, progress forwarded to the renderer after validation. Main closes the worker once its
// final message arrives; a worker that dies without one is restarted on the shared retry policy (src/shared/retry.ts).
// All connections import in one job (one worker, one job file). Tokens go to the worker in the `start` message only;
// nothing sent to the renderer or logged can contain them. A connection without a token is skipped and reported.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { kyivStartOfDay, toKyivDate } from '@mono/core/format';
import type { ProviderId } from '@mono/core/providers/types';
import { FromWorker, type ToWorker } from '../shared/import-protocol.ts';
import type { ImportDepth, ImportFailure, ImportProgress, StartImportResult } from '../shared/progress.ts';
import { nextRetryDelay, sleptDuringPause } from '../shared/retry.ts';

export const JOB_FILE = 'import-job.json';
export const CANCEL_KILL_MS = 10_000;
export const NO_TOKEN_MESSAGE = 'Токен не сохранён — введи его заново, чтобы импортировать это подключение.';
export const CRASH_GIVE_UP_MESSAGE = 'Процесс импорта несколько часов подряд неожиданно завершался. Импорт продолжится со следующего запуска.';

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
type Job = z.infer<typeof JobSchema>;

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
  dbPath: string;
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

  async start(depth: ImportDepth): Promise<StartImportResult> {
    return this.launch({ sinceSec: sinceForDepth(depth, this.d.nowSec()), depth, startedAt: this.d.nowSec() }, false);
  }

  /**
   * On launch: an unfinished job resumes by itself for the connections whose token is in secure storage (the rest are
   * reported as skipped); with none, the UI asks for the tokens.
   */
  async resumeOnLaunch(): Promise<void> {
    const job = this.readJob();
    if (!job || this.running) return;
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
      this.emit({ phase: 'cancelled' });
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
    this.removeJob();
    this.emit({ phase: 'idle' });
  }

  /** App quit: stop the worker, keep the job file (the import resumes next launch). */
  shutdown(): void {
    this.shuttingDown = true;
    this.clearRestart();
    this.child?.kill();
  }

  /** `only`: the connections to take (resume on launch: those with a saved token); absent — every connection. */
  private async launch(job: Job, resumed: boolean, only?: readonly number[]): Promise<StartImportResult> {
    if (this.running) return { started: false, reason: 'running' };
    const all = await this.d.connections();
    const connections: Array<{ connectionId: number; provider: ProviderId; token: string }> = [];
    for (const c of all) {
      if (only && !only.includes(c.connectionId)) continue;
      const token = await this.d.tokens.get(c.connectionId);
      if (token) connections.push({ ...c, token });
    }
    const skipped = all.filter((c) => !connections.some((x) => x.connectionId === c.connectionId)).map((c) => c.connectionId);
    if (connections.length === 0) {
      if (resumed) this.emit({ phase: 'needs-token', connectionIds: skipped });
      return { started: false, reason: 'no-token' };
    }
    this.writeJob(job);
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
        this.emit(msg.progress);
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
          ...msg.failed.map(({ connectionId, message }) => ({ connectionId, message })),
          ...skipped.map((connectionId) => ({ connectionId, message: NO_TOKEN_MESSAGE })),
        ];
        this.emit({ phase: 'done', windowsTotal: msg.windowsTotal, transactions: msg.transactions, failed });
      } else if (msg.kind === 'cancelled') {
        // A user cancel ends the job; any other error keeps it for the next launch.
        this.removeJob();
        this.emit({ phase: 'cancelled' });
      } else {
        this.emit({ phase: 'error', message: msg.message });
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
        this.emit({ phase: 'cancelled' });
        return;
      }
      this.scheduleRestart(job);
    });
    this.emit({ phase: 'starting', resumed });
    child.postMessage({ type: 'start', dbPath: this.d.dbPath, connections, sinceSec: job.sinceSec });
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
      this.emit({ phase: 'error', message: CRASH_GIVE_UP_MESSAGE });
      return;
    }
    this.d.log(`import: worker died, restart ${this.crashAttempt} in ${delay / 1000} s`);
    this.emit({ phase: 'retry', reason: 'crash', attempt: this.crashAttempt, inSec: delay / 1000 });
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

  private emit(p: ImportProgress): void {
    this.last = p;
    this.d.send(p);
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

  private removeJob(): void {
    fs.rmSync(this.jobFile, { force: true });
  }
}
