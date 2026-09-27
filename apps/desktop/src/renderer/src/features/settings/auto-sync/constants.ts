import type { AutoSyncTrigger } from '@contract/auto-sync.ts';

export const TRIGGER_LABELS = {
  launch: 'При запуске приложения',
  wake: 'После выхода компьютера из сна',
  interval: 'Каждые 4 часа, пока приложение открыто',
} as const satisfies Record<AutoSyncTrigger, string>;
