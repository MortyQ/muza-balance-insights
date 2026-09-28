// The app lock as main, the preload and the renderer see it. Plain types and pure checks only (no imports):
// the sandboxed preload and the renderer (@contract/lock.ts) bundle this file as is.

/** System idle time after which the app locks (the «60 минут» trigger). */
export const IDLE_LOCK_SEC = 3600;
export const PIN_MIN = 4;
export const PIN_MAX = 8;
export const PIN_RE = /^\d{4,8}$/;
/** Wrong PINs in a row before the first pause; from then on «Забыли PIN?» is always shown. */
export const FREE_ATTEMPTS = 5;

export const LOCK_TRIGGERS = ['startup', 'idle', 'screenLock', 'sleep'] as const;
export type LockTrigger = (typeof LOCK_TRIGGERS)[number];
export type LockTriggers = Record<LockTrigger, boolean>;
export const DEFAULT_TRIGGERS: LockTriggers = { startup: true, idle: true, screenLock: true, sleep: true };

export type LockView = {
  /** A PIN is set (or lock.json exists but is unreadable). */
  enabled: boolean;
  locked: boolean;
  /** lock.json unreadable: stays locked, the only way out is «Удалить все данные». */
  broken: boolean;
  /** This Mac can show the Touch ID prompt. */
  touchIdAvailable: boolean;
  /** The user's switch; used only when touchIdAvailable. */
  touchId: boolean;
  triggers: LockTriggers;
  failedAttempts: number;
  /** Epoch ms before which no PIN is checked; null = now. */
  retryAt: number | null;
  /** An import runs (the lock screen says so, without numbers). */
  importRunning: boolean;
};

export type LockResult =
  | { ok: true }
  | { ok: false; reason: 'wrong-pin' | 'wait'; retryAt: number | null }
  | { ok: false; reason: 'cancelled' | 'unavailable' };

export type DisableAuth = { pin: string } | { touchId: true };

/** Why a new PIN is refused; the renderer words it (`settings.lock.pinProblem.<problem>`). */
export type PinProblem = 'length' | 'same' | 'sequence';

/** Why a new PIN is refused; null = fine. */
export function pinProblem(pin: string): PinProblem | null {
  if (!PIN_RE.test(pin)) return 'length';
  if (/^(\d)\1+$/.test(pin)) return 'same';
  const digits = Array.from(pin, Number);
  const steps = digits.slice(1).map((d, i) => d - (digits[i] ?? d));
  if (steps.every((s) => s === 1) || steps.every((s) => s === -1)) return 'sequence';
  return null;
}
