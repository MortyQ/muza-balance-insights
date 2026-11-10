import type { ComputedRef } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

/** One driver row: the payee, its category and share of the change, its own difference with its sign. */
export interface DriverRowView {
  key: string;
  icon: string;
  name: string;
  caption: string;
  amount: string;
  /** The difference in the picked «also» currencies, one line; '' — none picked. */
  also: string;
  tone: 'up' | 'down';
  /** The category's screen; null — an unknown category word. */
  to: RouteLocationRaw | null;
}

export interface SavingsView {
  /** «Kept from income», or «Spent more than earned» for a negative rate. */
  title: string;
  value: string;
  usual: string;
  over: boolean;
}

export interface HomeInsightsView {
  drivers: DriverRowView[];
  savings: SavingsView | null;
  note: string;
  /** «Still pending … counted: N operations»; null without pending holds. */
  pending: string | null;
}

export interface UseHomeInsightsReturn {
  /** null — nothing to show: no driver and no savings rate (the note alone does not make the block). */
  view: ComputedRef<HomeInsightsView | null>;
  visible: ComputedRef<boolean>;
}
