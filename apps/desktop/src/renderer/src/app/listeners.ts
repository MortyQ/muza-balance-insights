import type { Router } from 'vue-router';
import { useAppLockStore } from '@/entities/app-lock';
import { useAppUpdateStore } from '@/entities/app-update';
import { useDbStateStore } from '@/entities/db-state';
import { FINISHED_PHASES, useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { balanceApi } from '@/shared/api';
import { ROUTE } from '@/shared/config';
import { throttle } from '@/shared/lib';

/** While an import runs, the data screens reload after each imported window, at most this often. */
export const LIVE_REFRESH_MS = 3_000;

/**
 * The main → renderer subscriptions, once per app. Reactions that span entities live here (entities never import
 * each other): an import that needs a token refreshes the people and their token statuses; every imported window
 * (throttled) and the end of an import refresh the data. People are refreshed when the windows start (the accounts are
 * in, a name from the bank may be) and when the import ends (coverage, failed connections).
 */
export function listenToMain(router: Router): () => void {
  const importProgress = useImportProgressStore();
  const participant = useParticipantStore();
  const refreshPeople = () => void participant.refresh().catch(() => undefined);
  const syncStatus = useSyncStatusStore();
  const appUpdate = useAppUpdateStore();
  const appLock = useAppLockStore();
  const dbState = useDbStateStore();
  const monthStore = useMonthStore();

  const live = throttle(() => {
    monthStore.refresh();
    void syncStatus.refresh();
  }, LIVE_REFRESH_MS);
  // windowsDone of the last refresh; any change (a new window, or a restarted worker counting from 0) is new data.
  let windowsSeen = 0;

  const offProgress = balanceApi.onProgress((p) => {
    const was = importProgress.progress.phase;
    importProgress.set(p);
    if (p.phase === 'needs-token' || (p.phase === 'windows' && was !== 'windows')) refreshPeople();
    if (p.phase === 'windows' && p.windowsDone !== windowsSeen) {
      windowsSeen = p.windowsDone;
      if (p.windowsDone > 0) live.call();
    }
    if (FINISHED_PHASES.includes(p.phase) && was !== p.phase) {
      live.cancel();
      windowsSeen = 0;
      monthStore.refresh();
      void syncStatus.refresh();
      refreshPeople();
    }
  });
  const offUpdate = balanceApi.onUpdate((v) => appUpdate.set(v));
  // main also sends the view when the page has loaded; this covers a subscription that came later. Skipped while
  // locked: the gate refuses it (and logs it in main), and main pushes the update view again once the app unlocks.
  if (!appLock.locked) void appUpdate.refresh().catch(() => undefined);
  const offSettings = balanceApi.onOpenSettings(() => void router.push({ name: ROUTE.settings }));
  // main reloads the page when it locks; this covers the lock screen opening (and a lock from another trigger).
  const offLock = balanceApi.onLock((v) => {
    appLock.set(v);
    const onLockScreen = router.currentRoute.value.name === ROUTE.lock;
    if (v.locked && !onLockScreen) void router.replace({ name: ROUTE.lock });
    if (!v.locked && onLockScreen) void router.replace({ name: ROUTE.home });
  });
  // Not ready → the recovery screen (never over the lock screen: the lock comes first). Ready again («Start over»,
  // «Delete all data») → a new, different database: people and data are fetched afresh before home picks its screen.
  const offDbState = balanceApi.onDbState((v) => {
    dbState.set(v);
    const route = router.currentRoute.value.name;
    if (route === ROUTE.lock) return;
    if (!dbState.ready && route !== ROUTE.dbRecovery) void router.replace({ name: ROUTE.dbRecovery });
    if (dbState.ready && route === ROUTE.dbRecovery) {
      monthStore.refresh();
      void Promise.all([participant.refresh(), syncStatus.refresh()])
        .catch(() => undefined)
        .then(() => router.replace({ name: ROUTE.home }));
    }
  });
  // Across a month boundary while the app stays open (or minimized/asleep), the clock has moved on by the time the
  // window regains focus. Guarded: renderer tests run without a DOM.
  const onFocus = () => monthStore.refresh();
  if (typeof window !== 'undefined') window.addEventListener('focus', onFocus);
  return () => {
    live.cancel();
    offProgress();
    offUpdate();
    offSettings();
    offLock();
    offDbState();
    if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus);
  };
}
