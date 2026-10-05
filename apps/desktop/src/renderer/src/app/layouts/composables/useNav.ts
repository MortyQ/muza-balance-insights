import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { RouteName } from '@/shared/config';
import { navGroups } from '../utils.ts';

/** The side menu built from the routes: the open route is the current item, a pick opens its route. */
export function useNav() {
  const router = useRouter();
  const route = useRoute();
  const groups = navGroups(router.getRoutes());
  const current = computed(() => String(route.name) as RouteName);
  const select = (name: RouteName) => {
    if (name !== route.name) void router.push({ name });
  };
  return { groups, current, select };
}
