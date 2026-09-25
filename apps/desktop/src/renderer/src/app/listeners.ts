import type { Router } from 'vue-router';
import { useAppUpdateStore } from '@/entities/app-update';
import { FINISHED_PHASES, useImportProgressStore } from '@/entities/import-progress';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useTokenStore } from '@/entities/token';
import { balanceApi } from '@/shared/api';
import { ROUTE } from '@/shared/config';

/**
 * The main → renderer subscriptions, once per app. Reactions that span entities live here (entities never import
 * each other): an import that needs a token refreshes the token status; an import that ended refreshes the data.
 */
export function listenToMain(router: Router): () => void {
  const importProgress = useImportProgressStore();
  const token = useTokenStore();
  const syncStatus = useSyncStatusStore();
  const appUpdate = useAppUpdateStore();

  const offProgress = balanceApi.onProgress((p) => {
    const was = importProgress.progress.phase;
    importProgress.set(p);
    if (p.phase === 'needs-token') void token.refresh();
    if (FINISHED_PHASES.includes(p.phase) && was !== p.phase) void syncStatus.refresh();
  });
  const offUpdate = balanceApi.onUpdate((v) => appUpdate.set(v));
  // main also sends the view when the page has loaded; this covers a subscription that came later.
  void appUpdate.refresh().catch(() => undefined);
  const offSettings = balanceApi.onOpenSettings(() => void router.push({ name: ROUTE.settings }));
  return () => {
    offProgress();
    offUpdate();
    offSettings();
  };
}
