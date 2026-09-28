import { balanceApi } from '@/shared/api';
import type { AppLockRequest } from '../types.ts';

export function useAppLockRequest(): AppLockRequest {
  return {
    unlockWithPin: (pin) => balanceApi.unlockWithPin(pin),
    unlockWithTouchId: () => balanceApi.unlockWithTouchId(),
    // «Forgot your PIN?»: main asks in a system dialog first and then opens the app as a fresh install.
    deleteAllData: () => balanceApi.deleteAllData(),
    enableLock: (pin) => balanceApi.enableLock(pin),
    changePin: (current, next) => balanceApi.changePin(current, next),
    disableLock: (auth) => balanceApi.disableLock(auth),
    setLockTriggers: (triggers) => balanceApi.setLockTriggers(triggers),
    setTouchId: (enabled) => balanceApi.setTouchId(enabled),
    lockNow: () => balanceApi.lockNow(),
  };
}
