import type { MessageKey } from '@contract/i18n/index.ts';

export interface SideNavItem<T extends string> {
  /** Dictionary key of the item's name. */
  label: MessageKey;
  icon: string;
  /** null: shown disabled with «Soon», nothing to open yet. */
  id: T | null;
}

export interface SideNavGroup<T extends string> {
  /** Dictionary key of the group's title; without it the group has no title. */
  label?: MessageKey;
  items: ReadonlyArray<SideNavItem<T>>;
}
