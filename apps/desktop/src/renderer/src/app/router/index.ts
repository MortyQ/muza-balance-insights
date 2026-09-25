import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';
import { ROUTE } from '@/shared/config';
import { startGuard } from './guards.ts';

// Memory history: there is no address bar, and the page URL stays app://renderer/index.html (CSP and the protocol
// handler see one file). Pages are separate chunks, served by app:// like every other asset.
const routes: RouteRecordRaw[] = [
  { path: '/', name: ROUTE.home, component: () => import('@/pages/home').then((m) => m.HomePage) },
  { path: '/connect', name: ROUTE.connect, component: () => import('@/pages/connect').then((m) => m.ConnectPage) },
  { path: '/settings', name: ROUTE.settings, component: () => import('@/pages/settings').then((m) => m.SettingsPage) },
  { path: '/:rest(.*)*', redirect: { name: ROUTE.home } },
];

export function createAppRouter() {
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.beforeEach(startGuard);
  return router;
}
