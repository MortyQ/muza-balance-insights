import type { Router } from 'vue-router';
import { useAppUpdateStore } from '@/entities/app-update';
import { FINISHED_PHASES, useImportProgressStore } from '@/entities/import-progress';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useTokenStore } from '@/entities/token';
import { balanceApi } from '@/shared/api';
import { ROUTE } from '@/shared/config';
import { throttle } from '@/shared/lib';

/** While an import runs, the data screens reload after each imported window, at most this often. */
export const LIVE_REFRESH_MS = 3_000;

/**
 * The main → renderer subscriptions, once per app. Reactions that span entities live here (entities never import
 * each other): an import that needs a token refreshes the token status; every imported window (throttled) and the end
 * of an import refresh the data.
 */
export function listenToMain(router: Router): () => void {
  const importProgress = useImportProgressStore();
  const token = useTokenStore();
  const syncStatus = useSyncStatusStore();
  const appUpdate = useAppUpdateStore();

  const live = throttle(() => void syncStatus.refresh(), LIVE_REFRESH_MS);
  // windowsDone of the last refresh; any change (a new window, or a restarted worker counting from 0) is new data.
  let windowsSeen = 0;

  const offProgress = balanceApi.onProgress((p) => {
    const was = importProgress.progress.phase;
    importProgress.set(p);
    if (p.phase === 'needs-token') void token.refresh();
    if (p.phase === 'windows' && p.windowsDone !== windowsSeen) {
      windowsSeen = p.windowsDone;
      if (p.windowsDone > 0) live.call();
    }
    if (FINISHED_PHASES.includes(p.phase) && was !== p.phase) {
      live.cancel();
      windowsSeen = 0;
      void syncStatus.refresh();
    }
  });
  const offUpdate = balanceApi.onUpdate((v) => appUpdate.set(v));
  // main also sends the view when the page has loaded; this covers a subscription that came later.
  void appUpdate.refresh().catch(() => undefined);
  const offSettings = balanceApi.onOpenSettings(() => void router.push({ name: ROUTE.settings }));
  return () => {
    live.cancel();
    offProgress();
    offUpdate();
    offSettings();
  };
}
