import { ROUTE, type RouteName } from '@/shared/config';

/**
 * The connect screen only when there is nothing to show: no connection and no data. A connection without a token (a
 * memory-only token after a restart) keeps home, with a notice to enter it — connecting again would add a second one.
 */
export function startRoute(hasConnections: boolean, hasData: boolean): RouteName {
  return !hasConnections && !hasData ? ROUTE.connect : ROUTE.home;
}
