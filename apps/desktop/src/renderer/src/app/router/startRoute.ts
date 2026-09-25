import { ROUTE, type RouteName } from '@/shared/config';

/**
 * The connect screen only when there is nothing to show: no token and no data. With data but no token (a memory-only
 * token after a restart, or «Отключить») home stays, with a notice — the user still sees their numbers.
 */
export function startRoute(tokenPresent: boolean, hasData: boolean): RouteName {
  return !tokenPresent && !hasData ? ROUTE.connect : ROUTE.home;
}
