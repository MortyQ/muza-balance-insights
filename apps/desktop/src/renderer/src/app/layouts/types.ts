import type { MessageKey } from '@contract/i18n/index.ts';

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
  }
}
