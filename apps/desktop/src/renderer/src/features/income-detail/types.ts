import type { ComputedRef, Ref } from 'vue';
import type { IncomeOverview, IncomeSourceId } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import type { LineRowView, MonthsView, PersonView, ShareItemView, SortKey, SummaryView, WhenView } from '@/entities/operations';
import type { Loadable } from '@/shared/lib';

/** A row of «Where from»: a source, its amount and share, on the largest one's scale. */
export interface SourceView {
  source: IncomeSourceId;
  label: string;
  amount: string;
  caption: string;
  width: number;
}

export interface UseIncomeDetailReturn {
  state: Readonly<Ref<Loadable<IncomeOverview>>>;
  view: ComputedRef<IncomeOverview | null>;
  /** The family view with more than one person. */
  family: ComputedRef<boolean>;
  /** «Whole family» or the person of the global filter; '' — the only person. */
  who: ComputedRef<string>;
  fmt: ComputedRef<MoneyFormat>;
}

export interface UseIncomeViewReturn {
  summary: ComputedRef<SummaryView | null>;
  /** The month has no income; '' — it has. */
  none: ComputedRef<string>;
  months: ComputedRef<MonthsView | null>;
  people: ComputedRef<PersonView[]>;
  sources: ComputedRef<SourceView[]>;
  senders: ComputedRef<ShareItemView[]>;
  moreSenders: ComputedRef<string>;
  when: ComputedRef<WhenView | null>;
  rows: ComputedRef<LineRowView[]>;
  /** The list's total: the month's figure while nothing filters it, else the shown lines' sum. */
  total: ComputedRef<string>;
  /** The sender the list is filtered by, its key; null — none. */
  sender: Ref<string | null>;
  senderName: ComputedRef<string>;
  query: Ref<string>;
  sort: Ref<SortKey>;
  pickSender: (key: string) => void;
}
