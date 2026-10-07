import type { ComputedRef, Ref } from 'vue';
import type { CategoryOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import type { LineRowView, MonthsView, PersonView, ShareItemView, SortKey, SummaryView, WhenView } from '@/entities/operations';
import type { Loadable } from '@/shared/lib';

export interface UseCategoryDetailReturn {
  state: Readonly<Ref<Loadable<CategoryOverview>>>;
  view: ComputedRef<CategoryOverview | null>;
  /** The family view with more than one person. */
  family: ComputedRef<boolean>;
  /** «Whole family» or the person of the global filter; '' — the only person. */
  who: ComputedRef<string>;
  fmt: ComputedRef<MoneyFormat>;
}

export interface UseCategoryViewReturn {
  summary: ComputedRef<SummaryView | null>;
  /** The figure's label for the period («Spent this month»). */
  label: ComputedRef<string>;
  /** The period has no line of the category; '' — it has. */
  none: ComputedRef<string>;
  /** A month only; null — another period. */
  months: ComputedRef<MonthsView | null>;
  people: ComputedRef<PersonView[]>;
  merchants: ComputedRef<ShareItemView[]>;
  moreMerchants: ComputedRef<string>;
  when: ComputedRef<WhenView | null>;
  rows: ComputedRef<LineRowView[]>;
  /** The list's total: the category's figure while nothing filters it, else the shown lines' sum. */
  total: ComputedRef<string>;
  /** The merchant the list is filtered by, its text; null — none. */
  merchant: Ref<string | null>;
  merchantName: ComputedRef<string>;
  query: Ref<string>;
  sort: Ref<SortKey>;
  pickMerchant: (key: string) => void;
}
