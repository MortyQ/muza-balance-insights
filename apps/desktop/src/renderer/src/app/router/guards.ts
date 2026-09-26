import type { NavigationGuard } from 'vue-router';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useParticipantStore } from '@/entities/participant';
import { ROUTE } from '@/shared/config';
import { startRoute } from './startRoute.ts';

/**
 * Home and connect swap according to startRoute; settings are always reachable (Cmd+, works on the connect screen too).
 * The first navigation waits for the connections and data status, so no screen flashes before we know which one to show.
 */
export const startGuard: NavigationGuard = async (to) => {
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
