import type { ComputedRef, Ref } from 'vue';
import type { CategoryId } from '@contract/categories.ts';
import type { CategoryOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import type { LineRowView, MonthsView, PartView, PersonView, ShareItemView, SortKey, SummaryView, WhenView } from '@/entities/operations';
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

/** What a link opens the list with: the search text ('' — none) and the payee filter (a payeeKey; null — none). */
export interface ListOpen {
  q: string;
  merchant: string | null;
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
  /** «By bank»: the banks with a positive part. */
  banks: ComputedRef<PartView[]>;
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

/** The line the picker is open for. */
export interface PickingLine {
  key: string;
  merchant: string;
}

export interface UseCategoryChoiceReturn {
  /** The line whose category is being picked; null — the picker is closed. */
  picking: Ref<PickingLine | null>;
  busy: Ref<boolean>;
  /** What the last choice did, or why it failed; null — nothing to say. */
  notice: Ref<{ text: string; failed: boolean } | null>;
  /** A line's menu action. */
  act: (key: string, action: string) => void;
  /** The picker's choice for the line it is open for. */
  save: (category: CategoryId, payee: boolean) => Promise<void>;
}
