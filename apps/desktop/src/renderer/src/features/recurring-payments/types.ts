import type { ComputedRef, Ref } from 'vue';
import type { RecurringMark, RecurringOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import type { Loadable } from '@/shared/lib';

/** One regular payment as a row shows it. */
export interface RecurringRowView {
  key: string;
  name: string;
  /** Category, and the person in the family view of more than one. */
  caption: string;
  icon: string;
  /** The usual payment in the screen's currency, or in the account's when it has no rate. */
  amount: string;
  /** The operation's own currency («10 $») when it differs from the account's; '' — none. */
  operation: string;
  /** «next 5 April» for an active one, «last 4 January» for a stopped one. */
  when: string;
  /** The family view of more than one person: whose payment it is. */
  person: { name: string; color: string } | null;
  mandatory: boolean;
}

export interface RecurringSummaryView {
  /** The active ones' usual payments together, in the screen's currency. */
  total: string;
  /** The same in the other picked currencies; '' — none. */
  approx: string;
  /** «of which mandatory 1 200 ₴»; '' — none marked. */
  mandatory: string;
  /** «3 regular payments». */
  count: string;
  /** «Found in the statement since 1 March 2025». */
  since: string;
}

/** The regular payments line of home. */
export interface RecurringTeaserView {
  /** The monthly total, in the screen's currency. */
  total: string;
  /** «3 regular payments», with «of which mandatory …» when some are marked. */
  caption: string;
}

export interface UseRecurringTeaserReturn {
  /** null — another month picked, no active payments, or not loaded. */
  view: ComputedRef<RecurringTeaserView | null>;
}

export interface UseRecurringReturn {
  state: Readonly<Ref<Loadable<RecurringOverview>>>;
  view: ComputedRef<RecurringOverview | null>;
  fmt: ComputedRef<MoneyFormat>;
  /** Marks a payment's payee (or clears it) and reloads; a failure sets `markFailed`. */
  setMark: (key: string, mark: RecurringMark | null) => Promise<void>;
  markFailed: Readonly<Ref<boolean>>;
}

export interface UseRecurringViewReturn {
  summary: ComputedRef<RecurringSummaryView | null>;
  active: ComputedRef<RecurringRowView[]>;
  ended: ComputedRef<RecurringRowView[]>;
  hidden: ComputedRef<RecurringRowView[]>;
}
