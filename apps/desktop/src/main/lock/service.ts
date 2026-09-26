// The app lock in main: the state the IPC gate reads (isLocked), the unlock and settings handlers, the triggers.
// A UI lock, not encryption: the database and the tokens are as readable as before to anyone with the account's files.
// Every async call runs one after another (serial): two PINs sent at once can not both slip past a pause.
import { DEFAULT_TRIGGERS, pinProblem, type DisableAuth, type LockResult, type LockTrigger, type LockTriggers, type LockView } from '../../shared/lock.ts';
import { WAIT_MS, waitAfter } from './attempts.ts';
import { KDF, hashPin, verifyPin } from './pin.ts';
import { readLock, removeLock, writeLock, type LockFile } from './store.ts';

// A tampered or corrupted nextAttemptAt must never lock the user out for longer than the ladder's own top pause.
const MAX_WAIT_MS = Math.max(...WAIT_MS);

export type TouchIdLike = { available(): boolean; prompt(): Promise<boolean> };

export type LockDeps = {
  userDataDir: string;
  touchId: TouchIdLike;
  importRunning: () => boolean;
  now: () => number;
  /** The lock just closed: main reloads the renderer, so nothing it has shown stays in its memory. */
  onLocked: () => void;
  /** Any change of the view: lock, unlock, a wrong PIN, settings. */
  onChange: (view: LockView) => void;
  log: (message: string) => void;
};

export class LockService {
  private file: LockFile | null;
  private broken: boolean;
  private locked: boolean;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly d: LockDeps) {
    const read = readLock(d.userDataDir);
    this.file = read.kind === 'ok' ? read.file : null;
    this.broken = read.kind === 'broken';
    if (this.broken) d.log('lock file unreadable: staying locked');
    this.locked = this.broken || (this.file?.triggers.startup ?? false);
  }

  isLocked(): boolean {
    return this.locked;
  }

  view(): LockView {
    const f = this.file;
    const retryAt = f ? this.clampedRetryAt(f) : null;
    return {
      enabled: f !== null || this.broken,
      locked: this.locked,
      broken: this.broken,
      touchIdAvailable: this.d.touchId.available(),
      touchId: f?.touchId ?? false,
      triggers: f?.triggers ?? { ...DEFAULT_TRIGGERS },
      failedAttempts: f?.failedAttempts ?? 0,
      retryAt,
      importRunning: this.d.importRunning(),
    };
  }

  /** A trigger fired, or «Заблокировать сейчас». No-op when the lock is off, the trigger is off, or it is closed already. */
  lock(trigger: LockTrigger | 'manual'): void {
    if (this.locked || !this.file) return;
    if (trigger !== 'manual' && !this.file.triggers[trigger]) return;
    this.locked = true;
    this.d.onLocked();
    this.changed();
  }

  unlockWithPin(pin: string): Promise<LockResult> {
    return this.serial(async () => {
      if (!this.locked) return { ok: true };
      const r = await this.checkPin(pin);
      if (r.ok) this.open();
      return r;
    });
  }

  unlockWithTouchId(): Promise<LockResult> {
    return this.serial(async () => {
      if (!this.locked) return { ok: true };
      const r = await this.checkTouchId();
      if (r.ok) this.open();
      return r;
    });
  }

  enable(pin: string): Promise<void> {
    return this.serial(async () => {
      if (this.file || this.broken) throw new Error('lock already on');
      if (pinProblem(pin)) throw new Error('weak pin');
      const record = await hashPin(pin);
      this.file = {
        version: 1,
        hash: record.hash,
        kdf: { ...KDF, salt: record.kdf.salt },
        touchId: this.d.touchId.available(),
        triggers: { ...DEFAULT_TRIGGERS },
        failedAttempts: 0,
        nextAttemptAt: null,
      };
      await writeLock(this.d.userDataDir, this.file);
      this.changed();
    });
  }

  changePin(current: string, next: string): Promise<LockResult> {
    return this.serial(async () => {
      if (pinProblem(next)) throw new Error('weak pin');
      const r = await this.checkPin(current);
      if (!r.ok || !this.file) return r;
      const record = await hashPin(next);
      this.file = { ...this.file, hash: record.hash, kdf: { ...KDF, salt: record.kdf.salt } };
      await writeLock(this.d.userDataDir, this.file);
      this.changed();
      return r;
    });
  }

  disable(auth: DisableAuth): Promise<LockResult> {
    return this.serial(async () => {
      const r = 'pin' in auth ? await this.checkPin(auth.pin) : await this.checkTouchId();
      if (!r.ok) return r;
      await removeLock(this.d.userDataDir);
      this.file = null;
      this.changed();
      return r;
    });
  }

  setTriggers(triggers: LockTriggers): Promise<void> {
    return this.serial(() => this.update({ triggers: { ...triggers } }));
  }

  setTouchId(enabled: boolean): Promise<void> {
    return this.serial(async () => {
      if (enabled && !this.d.touchId.available()) throw new Error('touch id unavailable');
      await this.update({ touchId: enabled });
    });
  }

  /** After «Удалить все данные»: lock.json went with the rest; the app opens as a fresh install. */
  reset(): void {
    this.file = null;
    this.broken = false;
    this.locked = false;
    this.changed();
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async update(patch: Partial<Pick<LockFile, 'triggers' | 'touchId'>>): Promise<void> {
    if (!this.file) throw new Error('lock is off');
    this.file = { ...this.file, ...patch };
    await writeLock(this.d.userDataDir, this.file);
    this.changed();
  }

  /** A stored nextAttemptAt further than the ladder's own top pause is treated as that top pause. */
  private clampedRetryAt(f: LockFile): number | null {
    if (f.nextAttemptAt === null) return null;
    const now = this.d.now();
    if (f.nextAttemptAt <= now) return null;
    return Math.min(f.nextAttemptAt, now + MAX_WAIT_MS);
  }

  private async checkPin(pin: string): Promise<LockResult> {
    const f = this.file;
    if (!f) return { ok: false, reason: 'unavailable' };
    const retryAt = this.clampedRetryAt(f);
    if (retryAt !== null) return { ok: false, reason: 'wait', retryAt };
    if (await verifyPin(pin, f)) {
      await this.clearAttempts();
      return { ok: true };
    }
    const now = this.d.now();
    const failedAttempts = f.failedAttempts + 1;
    const wait = waitAfter(failedAttempts);
    this.file = { ...f, failedAttempts, nextAttemptAt: wait > 0 ? now + wait : null };
    await writeLock(this.d.userDataDir, this.file);
    this.changed();
    return { ok: false, reason: 'wrong-pin', retryAt: this.clampedRetryAt(this.file) };
  }

  private async checkTouchId(): Promise<LockResult> {
    if (!this.file?.touchId || !this.d.touchId.available()) return { ok: false, reason: 'unavailable' };
    if (!(await this.d.touchId.prompt())) return { ok: false, reason: 'cancelled' };
    await this.clearAttempts();
    return { ok: true };
  }

  private async clearAttempts(): Promise<void> {
    if (!this.file || (this.file.failedAttempts === 0 && this.file.nextAttemptAt === null)) return;
    this.file = { ...this.file, failedAttempts: 0, nextAttemptAt: null };
    await writeLock(this.d.userDataDir, this.file);
  }

  private open(): void {
    this.locked = false;
    this.changed();
  }

  private changed(): void {
    this.d.onChange(this.view());
  }
}
