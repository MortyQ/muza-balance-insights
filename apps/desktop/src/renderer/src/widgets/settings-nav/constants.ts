import type { SettingsSection } from '@/shared/config';

export interface NavItem {
  label: string;
  icon: string;
  /** null: shown disabled with «Скоро», no section yet. */
  section: SettingsSection | null;
}

export interface NavGroup {
  label: string;
  items: ReadonlyArray<NavItem>;
}

/** Group titles: hidden (for screen readers only) in the narrow strip. Not `not-sr-only`: it resets the padding. */
export const NAV_LABEL_CLASS =
  'select-none px-(--control-px) pb-1 text-2xs font-bold tracking-[0.08em] text-foreground-muted uppercase max-[45rem]:sr-only';

export const NAV_GROUPS = [
  {
    label: 'Пользователи',
    items: [
      { label: 'Люди', icon: 'lucide:users', section: 'people' },
      { label: 'Подключения', icon: 'lucide:landmark', section: 'connections' },
    ],
  },
  {
    label: 'Безопасность',
    items: [
      { label: 'Хранение и токены', icon: 'lucide:key-round', section: 'storage' },
      { label: 'Сеть', icon: 'lucide:globe', section: 'network' },
      { label: 'Данные', icon: 'lucide:database', section: 'data' },
    ],
  },
  {
    label: 'Приложение',
    items: [
      { label: 'Обновления', icon: 'lucide:refresh-cw', section: 'updates' },
      { label: 'Оформление', icon: 'lucide:palette', section: null },
      { label: 'О программе', icon: 'lucide:info', section: 'about' },
    ],
  },
] as const satisfies ReadonlyArray<NavGroup>;
