import type { RouteRecordRaw } from 'vue-router';
import { ROUTE, isCategoryId } from '@/shared/config';
import '../layouts/types.ts';

// Pages are separate chunks, served by app:// like every other asset. `meta.layout` picks the shell (absent: the data
// screens' one); `meta.nav` puts the route into that shell's side menu.
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: ROUTE.home,
    component: () => import('@/pages/home').then((m) => m.HomePage),
    meta: { nav: { label: 'home.nav.general', icon: 'lucide:layout-dashboard', order: 0 } },
  },
  {
    path: '/analytics',
    name: ROUTE.analytics,
    component: () => import('@/pages/analytics').then((m) => m.AnalyticsPage),
    meta: { nav: { label: 'home.nav.analytics', icon: 'lucide:chart-column', order: 1 }, periodFilter: 'range' },
  },
  {
    path: '/recurring',
    name: ROUTE.recurring,
    component: () => import('@/pages/recurring').then((m) => m.RecurringPage),
    meta: { nav: { label: 'home.nav.recurring', icon: 'lucide:repeat', order: 2 }, periodFilter: 'none' },
  },
  {
    // Opened from a row of «Spending»; an unknown category goes home.
    path: '/category/:id',
    name: ROUTE.category,
    component: () => import('@/pages/category').then((m) => m.CategoryPage),
    meta: { navParent: ROUTE.home },
    beforeEnter: (to) => (isCategoryId(to.params.id) ? true : { name: ROUTE.home }),
  },
  {
    // Opened from «Income» of the balances' month panel.
    path: '/income',
    name: ROUTE.income,
    component: () => import('@/pages/income').then((m) => m.IncomePage),
    meta: { navParent: ROUTE.home },
  },
  { path: '/connect', name: ROUTE.connect, component: () => import('@/pages/connect').then((m) => m.ConnectPage), meta: { layout: 'empty' } },
  { path: '/settings', name: ROUTE.settings, component: () => import('@/pages/settings').then((m) => m.SettingsPage), meta: { layout: 'empty' } },
  {
    path: '/db-recovery',
    name: ROUTE.dbRecovery,
    component: () => import('@/pages/db-recovery').then((m) => m.DbRecoveryPage),
    meta: { layout: 'empty' },
  },
  { path: '/lock', name: ROUTE.lock, component: () => import('@/pages/lock').then((m) => m.LockPage), meta: { layout: 'empty' } },
  { path: '/:rest(.*)*', redirect: { name: ROUTE.home } },
];
