import type { ComputedRef, Ref } from 'vue';
import type { AllowanceReserve } from '@contract/allowance.ts';
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

/** What the reserve field shows: whole units of a currency. */
export interface ReserveFieldValue {
  currency: AllowanceReserve['currency'];
  units: number;
}

export interface UseAllowanceReturn {
  state: Readonly<Ref<Loadable<AllowanceOverview>>>;
  /** The answer is there. */
  visible: ComputedRef<boolean>;
  view: ComputedRef<AllowanceView | null>;
  /** The saved reserve for the field (reserveField); null — not loaded. */
  reserve: ComputedRef<ReserveFieldValue | null>;
  /** Saves the reserve (minor units of the field's currency) and reloads; false — refused or failed. */
  setReserve: (amount: number) => Promise<boolean>;
}
