import type { RouteLocationNormalizedLoaded, RouteRecordNormalized } from 'vue-router';
import type { MessageKey } from '@contract/i18n/index.ts';
import type { SideNavGroup } from '@/shared/layout';
import type { SidebarNavItem } from '@/shared/ui';
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

/**
 * The app navigation's entries: the side menu's items as sidebar entries, each opening its route and standing for the
 * screens that name it in `meta.navParent` (a category screen → «General»).
 */
export function navItems(
  routes: ReadonlyArray<Pick<RouteRecordNormalized, 'name' | 'meta'>>,
  translate: (key: MessageKey) => string,
): SidebarNavItem[] {
  return (navGroups(routes)[0]?.items ?? []).flatMap(({ label, icon, id }) =>
    id === null
      ? []
      : [
          {
            id,
            label: translate(label),
            icon,
            to: { name: id },
            activeFor: routes.flatMap((r) => (r.meta.navParent === id && typeof r.name === 'string' ? [r.name] : [])),
          },
        ],
  );
}
