import { computed, onMounted, ref } from 'vue';
import { pinProblem, PIN_RE, type LockResult, type LockTrigger } from '@contract/lock.ts';
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

  // The current PIN's format is checked here so a too-short value never reaches the IPC schema (which would just
  // show the generic failure text); its own correctness (right/wrong) is still main's call.
  const currentPinProblem = (): string => (PIN_RE.test(current.value) ? '' : (pinProblem(current.value) ?? ''));
  const newPinProblem = (): string => (next.value !== repeat.value ? 'PIN не совпадают.' : (pinProblem(next.value) ?? ''));
  const withResult = async (call: Promise<LockResult>): Promise<string> => resultText(await call);

  function submit(): Promise<void> {
    switch (mode.value) {
      case 'enable':
        return act(async () => {
          const problem = newPinProblem();
          if (problem) return problem;
          appLock.set(await request.enableLock(next.value));
          return '';
        }).finally(clearPins);
      case 'change':
        return act(async () => currentPinProblem() || newPinProblem() || withResult(request.changePin(current.value, next.value))).finally(
          clearPins,
        );
      case 'disable':
        return act(async () => currentPinProblem() || withResult(request.disableLock({ pin: current.value }))).finally(clearPins);
      case 'idle':
        return Promise.resolve();
    }
  }

  const disableWithTouchId = () => act(() => withResult(request.disableLock({ touchId: true }))).finally(clearPins);

  function setTrigger(trigger: LockTrigger, on: boolean): Promise<void> {
    const v = appLock.view;
    if (!v) return Promise.resolve();
    return act(async () => {
      appLock.set(await request.setLockTriggers({ ...v.triggers, [trigger]: on }));
      return '';
    }, false);
  }

  const setTouchId = (on: boolean) =>
    act(async () => {
      appLock.set(await request.setTouchId(on));
      return '';
    }, false);
  const lockNow = () => void request.lockNow().catch(() => undefined);

  return { view, mode, current, next, repeat, busy, error, open, submit, disableWithTouchId, setTrigger, setTouchId, lockNow };
}
