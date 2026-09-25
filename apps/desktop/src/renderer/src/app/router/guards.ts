import type { NavigationGuard } from 'vue-router';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useTokenStore } from '@/entities/token';
import { ROUTE } from '@/shared/config';
import { startRoute } from './startRoute.ts';

/**
 * Home and connect swap according to startRoute; settings are always reachable (Cmd+, works on the connect screen too).
 * The first navigation waits for the token and data status, so no screen flashes before we know which one to show.
 */
export const startGuard: NavigationGuard = async (to) => {
  if (to.name === ROUTE.settings) return true;
  const token = useTokenStore();
  const syncStatus = useSyncStatusStore();
  try {
    if (token.status === null) await token.refresh();
  } catch {
    // Main did not answer: show home with whatever is known rather than no screen at all.
    return to.name === ROUTE.home ? true : { name: ROUTE.home };
  }
  if (syncStatus.status === null && !syncStatus.failed) await syncStatus.refresh();
  const start = startRoute(token.connected, syncStatus.hasData);
  return to.name === start ? true : { name: start };
};
