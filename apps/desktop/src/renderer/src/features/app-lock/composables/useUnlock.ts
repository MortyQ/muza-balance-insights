import { computed, ref } from 'vue';
import { FREE_ATTEMPTS, type LockResult } from '@contract/lock.ts';
import { useAppLockStore } from '@/entities/app-lock';
import { FAILED_TEXT } from '@/shared/lib';
import { useAppLockRequest } from '../api/useAppLockRequest.ts';
import type { UseUnlockReturn } from '../types.ts';
import { resultText, waitText } from '../utils.ts';
import { useNow } from './useNow.ts';

/** The lock screen. On success main pushes the open view and app/listeners.ts leaves the screen. */
export function useUnlock(): UseUnlockReturn {
  const request = useAppLockRequest();
  const appLock = useAppLockStore();
  const { now } = useNow();
  const pin = ref('');
  const busy = ref(false);
  const error = ref('');

  const wait = computed(() => waitText(appLock.view?.retryAt ?? null, now.value));
  const broken = computed(() => appLock.view?.broken ?? false);
  const touchId = computed(() => (appLock.view?.touchId ?? false) && (appLock.view?.touchIdAvailable ?? false));
  const canForget = computed(() => broken.value || (appLock.view?.failedAttempts ?? 0) >= FREE_ATTEMPTS);
  const importRunning = computed(() => appLock.view?.importRunning ?? false);

  async function run(call: () => Promise<LockResult>): Promise<void> {
    error.value = '';
    busy.value = true;
    try {
      const r = await call();
      error.value = resultText(r);
      // Never keep the PIN around after a check, success or not.
      pin.value = '';
    } catch {
      error.value = FAILED_TEXT;
      pin.value = '';
    } finally {
      busy.value = false;
    }
  }

  const submitPin = () => run(() => request.unlockWithPin(pin.value));
  const unlockTouchId = () => run(() => request.unlockWithTouchId());

  async function forgot(): Promise<void> {
    error.value = '';
    try {
      await request.deleteAllData();
    } catch {
      error.value = FAILED_TEXT;
    }
  }

  return { pin, busy, error, wait, broken, touchId, canForget, importRunning, submitPin, unlockTouchId, forgot };
}
