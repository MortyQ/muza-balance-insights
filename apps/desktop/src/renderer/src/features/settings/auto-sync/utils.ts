import type { AutoSyncSettings, AutoSyncTrigger } from '@contract/auto-sync.ts';

/**
 * The settings to save, as a plain object: what the screen holds is a Vue proxy (nested ones too), and IPC can't clone
 * a proxy — the call would fail in the preload before it reaches main.
 */
export function withChange(s: Readonly<AutoSyncSettings>, change: { enabled: boolean } | { trigger: AutoSyncTrigger; on: boolean }): AutoSyncSettings {
  const next: AutoSyncSettings = { enabled: s.enabled, triggers: { launch: s.triggers.launch, wake: s.triggers.wake, interval: s.triggers.interval } };
  if ('enabled' in change) next.enabled = change.enabled;
  else next.triggers[change.trigger] = change.on;
  return next;
}
