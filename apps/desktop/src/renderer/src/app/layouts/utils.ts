import type { RouteLocationNormalizedLoaded, RouteRecordNormalized } from 'vue-router';
import type { SideNavGroup } from '@/shared/layout';
import type { RouteName } from '@/shared/config';
import type { LayoutName } from './types.ts';

export function layoutOf(route: Pick<RouteLocationNormalizedLoaded, 'meta'>): LayoutName {
  return route.meta.layout ?? 'default';
}

/** The side menu of the default layout: every route with `meta.nav`, by `order`, in one untitled group. */
export function navGroups(routes: ReadonlyArray<Pick<RouteRecordNormalized, 'name' | 'meta'>>): SideNavGroup<RouteName>[] {
  const items = routes
    .flatMap((r) => (r.meta.nav && typeof r.name === 'string' ? [{ name: r.name as RouteName, nav: r.meta.nav }] : []))
    .sort((a, b) => a.nav.order - b.nav.order)
    .map(({ name, nav }) => ({ label: nav.label, icon: nav.icon, id: name }));
  return items.length ? [{ items }] : [];
}
