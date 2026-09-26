import { computed, onMounted, ref } from 'vue';
import { pinProblem, type LockResult, type LockTrigger } from '@contract/lock.ts';
import { useAppLockStore } from '@/entities/app-lock';
import { FAILED_TEXT } from '@/shared/lib';
import { useAppLockRequest } from '../api/useAppLockRequest.ts';
import type { LockSettingsMode, UseLockSettingsReturn } from '../types.ts';
import { resultText } from '../utils.ts';

/** Turning the lock on and off, changing the PIN, the trigger and Touch ID switches. main pushes every new view. */
export function useLockSettings(): UseLockSettingsReturn {
  const request = useAppLockRequest();
  const appLock = useAppLockStore();
  const view = computed(() => appLock.view);
  const mode = ref<LockSettingsMode>('idle');
  const current = ref('');
  const next = ref('');
  const repeat = ref('');
  const busy = ref(false);
  const error = ref('');

  onMounted(() => void appLock.refresh().catch(() => undefined));

  function open(m: LockSettingsMode): void {
    mode.value = m;
    current.value = '';
    next.value = '';
    repeat.value = '';
    error.value = '';
  }

  /** Never keep a PIN around after a submit, success or not. */
  function clearPins(): void {
    current.value = '';
    next.value = '';
    repeat.value = '';
  }

  /** Runs one action; its text ('' = done) goes to the error line, and a done form closes. */
  async function act(fn: () => Promise<string>, closeOnDone = true): Promise<void> {
    busy.value = true;
    error.value = '';
    try {
      error.value = await fn();
      if (!error.value && closeOnDone) open('idle');
    } catch {
      error.value = FAILED_TEXT;
    } finally {
      busy.value = false;
    }
  }

  const newPinProblem = (): string => (next.value !== repeat.value ? 'PIN не совпадают.' : (pinProblem(next.value) ?? ''));
  const withResult = async (call: Promise<LockResult>): Promise<string> => resultText(await call);

  function submit(): Promise<void> {
    switch (mode.value) {
      case 'enable':
        return act(async () => newPinProblem() || (appLock.set(await request.enableLock(next.value)), '')).finally(clearPins);
      case 'change':
        return act(async () => newPinProblem() || withResult(request.changePin(current.value, next.value))).finally(clearPins);
      case 'disable':
        return act(() => withResult(request.disableLock({ pin: current.value }))).finally(clearPins);
      case 'idle':
        return Promise.resolve();
    }
  }

  const disableWithTouchId = () => act(() => withResult(request.disableLock({ touchId: true })));

  function setTrigger(trigger: LockTrigger, on: boolean): Promise<void> {
    const v = appLock.view;
    if (!v) return Promise.resolve();
    return act(async () => (appLock.set(await request.setLockTriggers({ ...v.triggers, [trigger]: on })), ''), false);
  }

  const setTouchId = (on: boolean) => act(async () => (appLock.set(await request.setTouchId(on)), ''), false);
  const lockNow = () => void request.lockNow().catch(() => undefined);

  return { view, mode, current, next, repeat, busy, error, open, submit, disableWithTouchId, setTrigger, setTouchId, lockNow };
}
