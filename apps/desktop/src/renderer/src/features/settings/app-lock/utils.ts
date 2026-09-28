import { FREE_ATTEMPTS, PIN_MAX, type LockResult, type LockView } from '@contract/lock.ts';
import { t } from '@/shared/lib';

export function waitText(retryAt: number | null, now: number): string {
  if (retryAt === null || retryAt <= now) return '';
  const sec = Math.ceil((retryAt - now) / 1000);
  return sec < 60 ? t('settings.lock.waitSec', { sec }) : t('settings.lock.waitMin', { min: Math.ceil(sec / 60) });
}

export function resultText(r: LockResult): string {
  if (r.ok) return '';
  switch (r.reason) {
    case 'wrong-pin':
      return t('settings.lock.wrongPin');
    case 'wait':
      return t('settings.lock.wait');
    case 'cancelled':
      return t('settings.lock.cancelled');
    case 'unavailable':
      return t('settings.lock.unavailable');
  }
}

export function shouldShowHint(view: LockView | null, dismissed: boolean): boolean {
  return view !== null && !view.enabled && !dismissed;
}

/** PinField's model setter: only digits, cut to the longest allowed PIN. */
export function normalizePin(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, PIN_MAX);
}

/** «Forgot your PIN?» is always offered once the free attempts run out, or when lock.json itself is unreadable. */
export function canForgetPin(failedAttempts: number, broken: boolean): boolean {
  return broken || failedAttempts >= FREE_ATTEMPTS;
}

/** The lock screen asks for Touch ID by itself once, and only in a focused window: a prompt nobody sees would time out. */
export function shouldAutoPromptTouchId(s: { touchId: boolean; broken: boolean; busy: boolean; prompted: boolean; focused: boolean }): boolean {
  return s.touchId && !s.broken && !s.busy && !s.prompted && s.focused;
}
