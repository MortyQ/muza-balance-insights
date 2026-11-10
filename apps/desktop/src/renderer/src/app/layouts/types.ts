import type { MessageKey } from '@contract/i18n/index.ts';
import type { RouteName } from '@/shared/config';

/** The shells a screen can live in: `default` — the data screens (filters, side menu); `empty` — the screen alone. */
export type LayoutName = 'default' | 'empty';

/** A route's item in the side menu of the default layout. */
export interface RouteNav {
  /** Dictionary key of the item's name. */
  label: MessageKey;
  icon: string;
  /** Lower comes first. */
  order: number;
}

declare module 'vue-router' {
  interface RouteMeta {
    /** Absent: `default`. */
    layout?: LayoutName;
    /** Absent: not in the side menu. */
    nav?: RouteNav;
    /** A screen without its own menu item: the item shown as current (a category screen → «General»). */
    navParent?: RouteName;
    /**
     * The period the global filters offer: absent — one month (home); `range` — whole months (analytics); `none` — no
     * period (the screen has its own: regular payments).
     */
    periodFilter?: 'range' | 'none';
  }
}
