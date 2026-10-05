import type { SettingsSection } from '@/shared/config';
import type { SideNavGroup } from '@/shared/layout';

export const NAV_GROUPS = [
  {
    label: 'settings.nav.groupUsers',
    items: [
      { label: 'settings.nav.people', icon: 'lucide:users', id: 'people' },
      { label: 'settings.nav.connections', icon: 'lucide:landmark', id: 'connections' },
    ],
  },
  {
    label: 'settings.nav.groupSecurity',
    items: [
      { label: 'settings.nav.lock', icon: 'lucide:lock', id: 'lock' },
      { label: 'settings.nav.storage', icon: 'lucide:key-round', id: 'storage' },
      { label: 'settings.nav.network', icon: 'lucide:globe', id: 'network' },
      { label: 'settings.nav.data', icon: 'lucide:database', id: 'data' },
    ],
  },
  {
    label: 'settings.nav.groupApp',
    items: [
      { label: 'settings.nav.autoSync', icon: 'lucide:refresh-ccw', id: 'auto-sync' },
      { label: 'settings.nav.updates', icon: 'lucide:refresh-cw', id: 'updates' },
      { label: 'settings.nav.appearance', icon: 'lucide:palette', id: 'appearance' },
      { label: 'settings.nav.language', icon: 'lucide:languages', id: 'language' },
      { label: 'settings.nav.about', icon: 'lucide:info', id: 'about' },
    ],
  },
] as const satisfies ReadonlyArray<SideNavGroup<SettingsSection>>;
