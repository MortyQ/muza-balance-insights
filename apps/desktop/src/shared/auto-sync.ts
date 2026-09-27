// «Автообновление» as main, the preload and the renderer see it. Plain types only (no imports): the sandboxed preload
// and the renderer (@contract/auto-sync.ts) bundle this file as is.

/** When an automatic refresh may start: app launch, wake from sleep, the periodic check. */
export const AUTO_SYNC_TRIGGERS = ['launch', 'wake', 'interval'] as const;
export type AutoSyncTrigger = (typeof AUTO_SYNC_TRIGGERS)[number];
export type AutoSyncTriggers = Record<AutoSyncTrigger, boolean>;

export type AutoSyncSettings = {
  /** The main switch: off — no trigger starts anything. */
  enabled: boolean;
  triggers: AutoSyncTriggers;
};

export const DEFAULT_AUTO_SYNC: AutoSyncSettings = { enabled: true, triggers: { launch: true, wake: true, interval: true } };
