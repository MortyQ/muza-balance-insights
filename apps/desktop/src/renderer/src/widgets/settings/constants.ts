import type { MessageKey } from '@contract/i18n/index.ts';
import type { SettingsSection } from '@/shared/config';

export interface NavItem {
  /** Dictionary key of the item's name. */
  label: MessageKey;
  icon: string;
  /** null: shown disabled with «Soon», no section yet. */
  section: SettingsSection | null;
}

export interface NavGroup {
  /** Dictionary key of the group's title. */
  label: MessageKey;
  items: ReadonlyArray<NavItem>;
}

/** Group titles: hidden (for screen readers only) in the narrow strip. Not `not-sr-only`: it resets the padding. */
export const NAV_LABEL_CLASS =
  'select-none px-(--control-px) pb-1 text-2xs font-bold tracking-[0.08em] text-foreground-muted uppercase max-[45rem]:sr-only';

export const NAV_GROUPS = [
  {
    label: 'settings.nav.groupUsers',
    items: [
      { label: 'settings.nav.people', icon: 'lucide:users', section: 'people' },
      { label: 'settings.nav.connections', icon: 'lucide:landmark', section: 'connections' },
    ],
  },
  {
    label: 'settings.nav.groupSecurity',
    items: [
      { label: 'settings.nav.lock', icon: 'lucide:lock', section: 'lock' },
      { label: 'settings.nav.storage', icon: 'lucide:key-round', section: 'storage' },
      { label: 'settings.nav.network', icon: 'lucide:globe', section: 'network' },
      { label: 'settings.nav.data', icon: 'lucide:database', section: 'data' },
    ],
  },
  {
    label: 'settings.nav.groupApp',
    items: [
      { label: 'settings.nav.autoSync', icon: 'lucide:refresh-ccw', section: 'auto-sync' },
      { label: 'settings.nav.updates', icon: 'lucide:refresh-cw', section: 'updates' },
      { label: 'settings.nav.appearance', icon: 'lucide:palette', section: 'appearance' },
      { label: 'settings.nav.language', icon: 'lucide:languages', section: 'language' },
      { label: 'settings.nav.about', icon: 'lucide:info', section: 'about' },
    ],
  },
] as const satisfies ReadonlyArray<NavGroup>;
