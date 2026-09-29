import type { SideNavGroup } from '@/shared/layout';

export type HomeSection = 'general';

export const HOME_NAV = [
  { items: [{ label: 'home.nav.general', icon: 'lucide:layout-dashboard', id: 'general' }] },
] as const satisfies ReadonlyArray<SideNavGroup<HomeSection>>;
