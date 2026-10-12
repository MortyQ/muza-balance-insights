import type { MessageKey } from '@contract/i18n/index.ts';
import type { ConnectionsTab, SettingsSection } from '@/shared/config';
import type { SideNavGroup } from '@/shared/layout';

/** The tabs of «Connections»: the dictionary key of each one's name. */
export const CONNECTION_TAB_LABELS = {
  banks: 'settings.connections.tabs.banks',
  'auto-sync': 'settings.connections.tabs.autoSync',
  history: 'settings.connections.tabs.history',
} as const satisfies Record<ConnectionsTab, MessageKey>;

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
      { label: 'settings.nav.updates', icon: 'lucide:refresh-cw', id: 'updates' },
      { label: 'settings.nav.appearance', icon: 'lucide:palette', id: 'appearance' },
      { label: 'settings.nav.language', icon: 'lucide:languages', id: 'language' },
      { label: 'settings.nav.about', icon: 'lucide:info', id: 'about' },
    ],
  },
] as const satisfies ReadonlyArray<SideNavGroup<SettingsSection>>;
