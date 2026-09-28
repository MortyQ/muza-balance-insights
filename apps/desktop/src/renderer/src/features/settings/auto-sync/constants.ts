import type { AutoSyncTrigger } from '@contract/auto-sync.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

export const TRIGGER_LABELS = {
  launch: 'settings.autoSync.triggerLaunch',
  wake: 'settings.autoSync.triggerWake',
  interval: 'settings.autoSync.triggerInterval',
} as const satisfies Record<AutoSyncTrigger, MessageKey>;
