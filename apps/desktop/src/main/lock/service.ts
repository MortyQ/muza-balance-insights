// The app lock in main: the state the IPC gate reads (isLocked), the unlock and settings handlers, the triggers.
// A UI lock, not encryption: the database and the tokens are as readable as before to anyone with the account's files.
// Every async call runs one after another (serial): two PINs sent at once can not both slip past a pause.
import { DEFAULT_TRIGGERS, pinProblem, type DisableAuth, type LockResult, type LockTrigger, type LockTriggers, type LockView } from '../../shared/lock.ts';
import { WAIT_MS, waitAfter } from './attempts.ts';
import { hashPin, verifyPin } from './pin.ts';
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
  // Bumped by reset(), which runs outside the serial chain (it must take effect at once, e.g. after a wipe).
  // Every serialized op captures it before its first await and re-checks it after every later await, so an op
  // suspended mid-flight when reset() fires can't commit or write back state that reset() just cleared.
  private epoch = 0;

  constructor(private readonly d: LockDeps) {
    const read = readLock(d.userDataDir);
    this.file = read.kind === 'ok' ? read.file : null;
    this.broken = read.kind === 'broken';
    if (this.broken) d.log('lock file unreadable: staying locked');
    this.normalize();
    this.locked = this.broken || (this.file?.triggers.startup ?? false);
  }

  isLocked(): boolean {
    return this.locked;
  }

  view(): LockView {
    const f = this.file;
    const now = this.d.now();
    const retryAt = f && f.nextAttemptAt !== null && f.nextAttemptAt > now ? f.nextAttemptAt : null;
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
      const epoch = this.epoch;
      if (!this.locked) return { ok: true };
      const r = await this.checkPin(pin, epoch);
      if (epoch !== this.epoch) return { ok: false, reason: 'unavailable' };
      if (r.ok) this.open();
      return r;
    });
  }

  unlockWithTouchId(): Promise<LockResult> {
    return this.serial(async () => {
      const epoch = this.epoch;
      if (!this.locked) return { ok: true };
      const r = await this.checkTouchId(epoch);
      if (epoch !== this.epoch) return { ok: false, reason: 'unavailable' };
      if (r.ok) this.open();
      return r;
    });
  }

  enable(pin: string): Promise<void> {
    return this.serial(async () => {
      const epoch = this.epoch;
      if (this.locked) throw new Error('locked');
      if (this.file || this.broken) throw new Error('lock already on');
      if (pinProblem(pin)) throw new Error('weak pin');
      const record = await hashPin(pin);
      if (epoch !== this.epoch) throw new Error('lock state changed');
      const next: LockFile = {
        version: 1,
        ...record,
        touchId: this.d.touchId.available(),
        triggers: { ...DEFAULT_TRIGGERS },
        failedAttempts: 0,
        nextAttemptAt: null,
      };
      await writeLock(this.d.userDataDir, next);
      if (epoch !== this.epoch) throw new Error('lock state changed');
      this.file = next;
      this.changed();
    });
  }

  changePin(current: string, next: string): Promise<LockResult> {
    return this.serial(async () => {
      const epoch = this.epoch;
      if (this.locked) throw new Error('locked');
      if (pinProblem(next)) throw new Error('weak pin');
      const r = await this.checkPin(current, epoch);
      if (epoch !== this.epoch) return { ok: false, reason: 'unavailable' };
      if (!r.ok || !this.file) return r;
      const record = await hashPin(next);
      if (epoch !== this.epoch) return { ok: false, reason: 'unavailable' };
      const nextFile: LockFile = { ...this.file, ...record };
      await writeLock(this.d.userDataDir, nextFile);
      if (epoch !== this.epoch) return { ok: false, reason: 'unavailable' };
      this.file = nextFile;
      this.changed();
      return r;
    });
  }

  disable(auth: DisableAuth): Promise<LockResult> {
    return this.serial(async () => {
      const epoch = this.epoch;
      if (this.locked) throw new Error('locked');
      const r = 'pin' in auth ? await this.checkPin(auth.pin, epoch) : await this.checkTouchId(epoch);
      if (epoch !== this.epoch) return { ok: false, reason: 'unavailable' };
      if (!r.ok) return r;
      await removeLock(this.d.userDataDir);
      if (epoch !== this.epoch) return { ok: false, reason: 'unavailable' };
      this.file = null;
      this.changed();
      return r;
    });
  }

  setTriggers(triggers: LockTriggers): Promise<void> {
    return this.serial(async () => {
      const epoch = this.epoch;
      if (this.locked) throw new Error('locked');
      await this.update({ triggers: { ...triggers } }, epoch);
    });
  }

  setTouchId(enabled: boolean): Promise<void> {
    return this.serial(async () => {
      const epoch = this.epoch;
      if (this.locked) throw new Error('locked');
      if (enabled && !this.d.touchId.available()) throw new Error('touch id unavailable');
      await this.update({ touchId: enabled }, epoch);
    });
  }

  /** After «Удалить все данные»: lock.json went with the rest; the app opens as a fresh install. */
  reset(): void {
    this.epoch++;
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

  private async update(patch: Partial<Pick<LockFile, 'triggers' | 'touchId'>>, epoch: number): Promise<void> {
    if (!this.file) throw new Error('lock is off or unreadable');
    const next: LockFile = { ...this.file, ...patch };
    await writeLock(this.d.userDataDir, next);
    if (epoch !== this.epoch) throw new Error('lock state changed');
    this.file = next;
    this.changed();
  }

  /** A stored nextAttemptAt further than the ladder's own top pause is treated as that top pause — in memory only,
   *  so a clock moved back or a tampered value can't extend the wait every time it's read. */
  private normalize(): void {
    if (!this.file || this.file.nextAttemptAt === null) return;
    const now = this.d.now();
    if (this.file.nextAttemptAt > now + MAX_WAIT_MS) this.file = { ...this.file, nextAttemptAt: now + MAX_WAIT_MS };
  }

  private async checkPin(pin: string, epoch: number): Promise<LockResult> {
    this.normalize();
    const f = this.file;
    if (!f) return { ok: false, reason: 'unavailable' };
    const now = this.d.now();
    if (f.nextAttemptAt !== null && f.nextAttemptAt > now) return { ok: false, reason: 'wait', retryAt: f.nextAttemptAt };
    const valid = await verifyPin(pin, f);
    if (epoch !== this.epoch) return { ok: false, reason: 'unavailable' };
    if (valid) {
      await this.clearAttempts(epoch);
      if (epoch !== this.epoch) return { ok: false, reason: 'unavailable' };
      return { ok: true };
    }
    // Deliberate, unlike enable/changePin/update/clearAttempts: memory is updated before the write commits, so a
    // write failure here still counts the attempt towards the pause ladder — it fails closed, not open.
    const cur = this.file; // re-read after the await above, not the `f` captured before it
    if (!cur) return { ok: false, reason: 'unavailable' };
    const failedAttempts = cur.failedAttempts + 1;
    const wait = waitAfter(failedAttempts);
    this.file = { ...cur, failedAttempts, nextAttemptAt: wait > 0 ? now + wait : null };
    await writeLock(this.d.userDataDir, this.file);
    this.changed();
    return { ok: false, reason: 'wrong-pin', retryAt: this.file.nextAttemptAt };
  }

  private async checkTouchId(epoch: number): Promise<LockResult> {
    if (!this.file?.touchId || !this.d.touchId.available()) return { ok: false, reason: 'unavailable' };
    const ok = await this.d.touchId.prompt();
    if (epoch !== this.epoch) return { ok: false, reason: 'unavailable' };
    if (!ok) return { ok: false, reason: 'cancelled' };
    await this.clearAttempts(epoch);
    if (epoch !== this.epoch) return { ok: false, reason: 'unavailable' };
    return { ok: true };
  }

  private async clearAttempts(epoch: number): Promise<void> {
    const f = this.file;
    if (!f || (f.failedAttempts === 0 && f.nextAttemptAt === null)) return;
    const next: LockFile = { ...f, failedAttempts: 0, nextAttemptAt: null };
    await writeLock(this.d.userDataDir, next);
    if (epoch !== this.epoch) return; // reset happened during the write: don't resurrect the file
    this.file = next;
  }

  private open(): void {
    this.locked = false;
    this.changed();
  }

  private changed(): void {
    this.d.onChange(this.view());
  }
}
