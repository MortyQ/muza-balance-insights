import type { NavigationGuard } from 'vue-router';
import { useAppLockStore } from '@/entities/app-lock';
import { useDbStateStore } from '@/entities/db-state';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useParticipantStore } from '@/entities/participant';
import { ROUTE } from '@/shared/config';
import { startRoute } from './startRoute.ts';

/**
 * While locked every route is the lock screen; the lock route itself becomes home once open. Then the database: not
 * ready → every route, settings too, is the recovery screen (the lock comes first: «Start over» is not for whoever
 * sits at an unlocked computer); ready → the recovery route becomes home. Home and connect
 * otherwise swap according to startRoute; settings are always reachable (Cmd+, works on the connect screen too).
 * The first navigation waits for the connections and data status, so no screen flashes before we know which one to show.
 */
export const startGuard: NavigationGuard = async (to) => {
  // main is the authority (its IPC gate refuses data while locked); this only picks the screen.
  const appLock = useAppLockStore();
  if (appLock.view === null) await appLock.refresh().catch(() => undefined);
  if (appLock.locked) return to.name === ROUTE.lock ? true : { name: ROUTE.lock };
  if (to.name === ROUTE.lock) return { name: ROUTE.home };
  const dbState = useDbStateStore();
  if (dbState.view === null) await dbState.refresh().catch(() => undefined);
  if (!dbState.ready) return to.name === ROUTE.dbRecovery ? true : { name: ROUTE.dbRecovery };
  if (to.name === ROUTE.dbRecovery) return { name: ROUTE.home };
  if (to.name === ROUTE.settings) return true;
  const participant = useParticipantStore();
  const syncStatus = useSyncStatusStore();
  try {
    if (participant.view === null) await participant.refresh();
  } catch {
    // Main did not answer: show home with whatever is known rather than no screen at all.
    return to.name === ROUTE.home ? true : { name: ROUTE.home };
  }
  if (syncStatus.status === null && !syncStatus.failed) await syncStatus.refresh();
  const start = startRoute(participant.hasConnections, syncStatus.hasData);
  return to.name === start ? true : { name: start };
};
