// The data process from main's side: forks it (src/data/process.ts) with the database's path and key in `open`,
// forwards calls and matches the replies, sends today's rates ahead of a call that converts by them. Calls made before
// the process is ready wait for it. If it exits, the calls in flight fail and the next call forks a new one. stop()
// closes it and waits for the exit, so the database files can go («Delete all data», «Start over»).
import type { RatesView } from '../shared/api.ts';
import {
  FromData,
  OpenMessage,
  RATED_METHODS,
  type DataMethod,
  type DataReply,
  type ToData,
} from '../shared/data-protocol.ts';
import { dataApi, type DataApi } from './data-api.ts';

/** How long a closing process may take before it is killed. */
export const STOP_KILL_MS = 5_000;

export type DataChild = {
  postMessage(msg: ToData): void;
  kill(): boolean;
  on(event: 'message', listener: (msg: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
};

export type DataClientDeps = {
  fork: () => DataChild;
  /** The database (DbAccess.forProcess): its path and key; null while the database is unavailable. */
  db: () => { dbPath: string; dbKey: string | null } | null;
  /** Today's rates (RatesService.current: waits for a refresh in flight). */
  rates: () => Promise<RatesView | null>;
  /** The data process could not open the file with its key (DbAccess.markUnreadable). */
  unreadable: () => void;
  /** Main log: service lines only. */
  log: (msg: string) => void;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (t: unknown) => void;
};

type Proc = {
  child: DataChild;
  ready: Promise<boolean>;
  pending: Map<number, (reply: DataReply) => void>;
  exited: Promise<void>;
  /** The rates last sent, as JSON; undefined — none yet. */
  sentRates: string | undefined;
};

const RATED: ReadonlySet<DataMethod> = new Set(RATED_METHODS);

const failure = (id: number, name: string): DataReply => ({ type: 'failure', id, code: 'failed', name });

export class DataClient {
  readonly api: DataApi = dataApi((method, args) => this.call(method, args));
  private proc: Proc | null = null;
  private nextId = 0;

  constructor(private readonly d: DataClientDeps) {}

  /** Forks the process now (at launch: the migration starts before the first screen asks); a call forks it as well. */
  start(): void {
    this.proc ??= this.spawn();
  }

  /** Closes the process and resolves once it has exited; killed after STOP_KILL_MS. The next call forks a new one. */
  async stop(): Promise<void> {
    const proc = this.proc;
    this.proc = null;
    if (!proc) return;
    try {
      proc.child.postMessage({ type: 'close' });
    } catch {
      // Already gone: its exit is on the way.
    }
    const timer = (this.d.setTimeout ?? setTimeout)(() => {
      this.d.log('data: process did not stop in time, killing it');
      proc.child.kill();
    }, STOP_KILL_MS);
    await proc.exited;
    (this.d.clearTimeout ?? clearTimeout)(timer as ReturnType<typeof setTimeout>);
  }

  /** On quit: no waiting. */
  kill(): void {
    this.proc?.child.kill();
    this.proc = null;
  }

  private async call(method: DataMethod, args: unknown[]): Promise<DataReply> {
    const proc = (this.proc ??= this.spawn());
    if (!proc) return failure(0, 'DataUnavailable');
    const id = this.nextId++;
    if (RATED.has(method)) {
      const rates = await this.d.rates();
      const json = JSON.stringify(rates);
      if (json !== proc.sentRates && !this.post(proc, { type: 'rates', rates })) return failure(id, 'DataProcessExit');
      proc.sentRates = json;
    }
    if (!(await proc.ready)) return failure(id, 'DataUnavailable');
    return new Promise((resolve) => {
      proc.pending.set(id, resolve);
      if (!this.post(proc, { type: 'call', id, method, args })) {
        proc.pending.delete(id);
        resolve(failure(id, 'DataProcessExit'));
      }
    });
  }

  private post(proc: Proc, msg: ToData): boolean {
    try {
      proc.child.postMessage(msg);
      return true;
    } catch {
      return false;
    }
  }

  private spawn(): Proc | null {
    const open = OpenMessage.safeParse({ type: 'open', ...(this.d.db() ?? {}) });
    if (!open.success) {
      this.d.log('data: database unavailable, not started');
      return null;
    }
    const child = this.d.fork();
    let setReady: (ok: boolean) => void = () => undefined;
    let setExited: () => void = () => undefined;
    const proc: Proc = {
      child,
      ready: new Promise<boolean>((r) => (setReady = r)),
      pending: new Map(),
      exited: new Promise<void>((r) => (setExited = r)),
      sentRates: undefined,
    };
    child.on('message', (raw) => {
      const parsed = FromData.safeParse(raw);
      if (!parsed.success) {
        this.d.log('data: dropped a malformed message');
        return;
      }
      const msg = parsed.data;
      if (msg.type === 'ready') return setReady(true);
      if (msg.type === 'open-failed') {
        this.d.log(`data: open failed: ${msg.kind} (${msg.name})`);
        setReady(false);
        if (msg.kind === 'unreadable') this.d.unreadable();
        child.kill();
        return;
      }
      const waiting = proc.pending.get(msg.id);
      if (!waiting) {
        this.d.log('data: dropped a reply to no call');
        return;
      }
      proc.pending.delete(msg.id);
      waiting(msg);
    });
    child.on('exit', (code) => {
      this.d.log(`data: exit code=${code}`);
      if (this.proc === proc) this.proc = null;
      setReady(false);
      for (const [id, waiting] of proc.pending) waiting(failure(id, 'DataProcessExit'));
      proc.pending.clear();
      setExited();
    });
    child.postMessage(open.data);
    return proc;
  }
}
