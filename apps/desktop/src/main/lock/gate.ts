// What main may push to the renderer. Locked: the lock view only. Open, but the database not ready: the lock view and
// the database view (the recovery screen needs nothing else). Import progress, the update view and the «Настройки…»
// request are dropped; on unlock main sends the current progress and update view again.
import { DB_STATE_CHANNEL, LOCK_CHANNEL } from '../../shared/channels.ts';

/** Returns a push that reports whether it sent. */
export function gatedPush(
  isLocked: () => boolean,
  isDbReady: () => boolean,
  send: (channel: string, payload?: unknown) => void,
): (channel: string, payload?: unknown) => boolean {
  return (channel: string, payload?: unknown): boolean => {
    if (channel !== LOCK_CHANNEL && isLocked()) return false;
    if (channel !== LOCK_CHANNEL && channel !== DB_STATE_CHANNEL && !isDbReady()) return false;
    send(channel, payload);
    return true;
  };
}
