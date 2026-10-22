import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE } from '@/shared/config';
import { t } from '@/shared/lib';
import { createSidebar, type SidebarInstance, type SidebarNavItem } from '@/shared/ui';
import { navItems } from '../utils.ts';

/** Where the fold choice is kept on this computer (a convenience, like the spending block's menu). */
export const SIDEBAR_STORAGE_KEY = 'app.sidebar';
/** A medium window: the sidebar shows icons only, whatever the user chose. Narrower — the drawer (its own styles). */
export const ICONS_ONLY_QUERY = '(min-width: 45rem) and (max-width: 63.99rem)';

export interface UseAppSidebarReturn {
  sidebar: SidebarInstance;
  footerItems: ComputedRef<SidebarNavItem[]>;
}

/** Whether a media query matches now, kept up to date until the calling scope ends. */
export function useMedia(query: string): Readonly<Ref<boolean>> {
  const matches = ref(false);
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return matches;
  const list = window.matchMedia(query);
  matches.value = list.matches;
  const update = (e: MediaQueryListEvent) => {
    matches.value = e.matches;
  };
  list.addEventListener('change', update);
  onScopeDispose(() => list.removeEventListener('change', update));
  return matches;
}

/** The app navigation of the default layout: entries from the routes, texts in the current language, the width's forced icons. */
export function useAppSidebar(): UseAppSidebarReturn {
  const routes = useRouter().getRoutes();
  const sidebar = createSidebar({
    items: computed(() => navItems(routes, (key) => t(key))),
    storageKey: SIDEBAR_STORAGE_KEY,
    forceCollapsed: useMedia(ICONS_ONLY_QUERY),
    labels: () => ({
      nav: t('home.nav.label'),
      collapse: t('home.nav.collapse'),
      expand: t('home.nav.expand'),
      closeMenu: t('home.nav.closeMenu'),
    }),
  });
  const footerItems = computed<SidebarNavItem[]>(() => [
    { id: ROUTE.settings, label: t('header.settings'), icon: 'lucide:settings', to: { name: ROUTE.settings } },
  ]);
  return { sidebar, footerItems };
}
