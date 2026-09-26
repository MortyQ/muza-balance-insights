// What main may push to the renderer while the app is locked: the lock view only. Import progress, the update view
// and the «Настройки…» request are dropped; on unlock main sends the current progress and update view again.
import { LOCK_CHANNEL } from '../../shared/channels.ts';

/** Returns a push that reports whether it sent. */
export function gatedPush(
  isLocked: () => boolean,
  send: (channel: string, payload?: unknown) => void,
): (channel: string, payload?: unknown) => boolean {
  return (channel: string, payload?: unknown): boolean => {
    if (channel !== LOCK_CHANNEL && isLocked()) return false;
    send(channel, payload);
    return true;
  };
}
