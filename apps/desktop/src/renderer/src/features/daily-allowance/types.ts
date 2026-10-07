import type { ComputedRef, Ref } from 'vue';
import type { AllowanceOverview } from '@contract/api.ts';
import type { Loadable } from '@/shared/lib';

/** One line of «How it is counted»: a label and its amount with the sign it enters with. */
export interface BreakdownLine {
  label: string;
  amount: string;
  /** The result lines (free, per day): bold. */
  strong: boolean;
}

export interface AllowanceView {
  /** The sum per day, or what is short: in the screen's currency. */
  amount: string;
  /** Short of money: `amount` is the shortfall. */
  short: boolean;
  /** «until 10 April · 26 days» / «until the month's end · 17 days». */
  until: string;
  /** About the income: next, late or none. */
  income: string;
  lines: BreakdownLine[];
  /** Card currencies without a rate, left out; '' — none. */
  leftOut: string;
}

export interface UseAllowanceReturn {
  state: Readonly<Ref<Loadable<AllowanceOverview>>>;
  /** The month filter is this month and the answer is there. */
  visible: ComputedRef<boolean>;
  view: ComputedRef<AllowanceView | null>;
  /** The saved reserve in whole hryvnias, for the field. */
  reserve: ComputedRef<number>;
  /** Saves the reserve (whole hryvnias) and reloads; false — refused or failed. */
  setReserve: (hryvnias: number) => Promise<boolean>;
}
