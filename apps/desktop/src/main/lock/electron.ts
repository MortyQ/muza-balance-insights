// The only file of the app lock that imports electron: powerMonitor for the triggers, systemPreferences for Touch ID.
import { powerMonitor, systemPreferences } from 'electron';
import type { LockService, TouchIdLike } from './service.ts';
import { watchLockTriggers } from './triggers.ts';

// Electron's promptTouchID signs with a key under kSecAccessControlUserPresence: the system prompt itself offers the
// Mac password when the finger fails. canPromptTouchID checks for a sensor (or a Watch): without one, the PIN only.
export const touchId: TouchIdLike = {
  available: () => process.platform === 'darwin' && systemPreferences.canPromptTouchID(),
  prompt: () => systemPreferences.promptTouchID('разблокировать приложение').then(() => true, () => false),
};

/** lock-screen exists on macOS and Windows; on Linux only sleep and idle lock. */
export function startLockTriggers(lock: LockService): () => void {
  return watchLockTriggers(
    {
      onScreenLock: (l) => void powerMonitor.on('lock-screen', l),
      onSuspend: (l) => void powerMonitor.on('suspend', l),
      idleSeconds: () => powerMonitor.getSystemIdleTime(),
    },
    (t) => lock.lock(t),
    (fn, ms) => {
      const id = setInterval(fn, ms);
      return () => clearInterval(id);
    },
  );
}
