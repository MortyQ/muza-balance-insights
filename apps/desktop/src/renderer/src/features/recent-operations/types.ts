import type { ComputedRef } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

/** One row of «Recent operations». */
export interface RecentRowView {
  key: string;
  icon: string;
  /** The bank's description, else the category's name. */
  name: string;
  /** The category's name and when: «Кафе и рестораны · 05.03, 14:20». */
  caption: string;
  amount: string;
  refund: boolean;
  pending: boolean;
  /** The operation's category screen; null — an unknown category word. */
  to: RouteLocationRaw | null;
}

export interface UseRecentOperationsReturn {
  rows: ComputedRef<RecentRowView[]>;
  /** An answer is there: an empty list means no operations rather than not yet known. */
  loaded: ComputedRef<boolean>;
}
