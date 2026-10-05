import type { ComputedRef, Ref } from 'vue';
import type { CategoryOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import type { Loadable } from '@/shared/lib';
import type { ChangeChipModel } from '@/shared/ui';
import type { SORTS } from './constants.ts';

export type SortKey = (typeof SORTS)[number];

/** One figure of the summary grid: its label, value and the small line under it ('' — none). */
export interface StatView {
  label: string;
  value: string;
  note: string;
  tone?: 'good';
}

export interface SummaryView {
  name: string;
  icon: string;
  color: string;
  subtitle: string;
  amount: string;
  conv: string;
  chip: ChangeChipModel | null;
  /** «in August — 3 920 ₴»; '' — no comparison. */
  prev: string;
  /** Charged and refunded; '' — no refunds. */
  gross: string;
  stats: StatView[];
}

/** A bar of a chart: height in % of the chart, highlighted or not, its tooltip. */
export interface BarView {
  key: string;
  label: string;
  height: number;
  strong: boolean;
  title: string;
}

export interface MonthsView {
  bars: BarView[];
  /** The average line in % of the chart height; null — no month with data. */
  avg: number | null;
  caption: string;
}

export interface PersonView {
  participantId: number;
  name: string;
  initial: string;
  color: string;
  amount: string;
  caption: string;
  width: number;
}

export interface MerchantView {
  /** The bank's text as the lines read it ('' — none), the key of the filter. */
  key: string;
  name: string;
  amount: string;
  caption: string;
  width: number;
  pressed: boolean;
}

export interface DayPartView {
  label: string;
  amount: string;
  width: number;
  strong: boolean;
}

export interface WhenView {
  /** «When», or «When: Uklon» while the list is filtered by a merchant. */
  title: string;
  weekdays: BarView[];
  dayParts: DayPartView[];
  days: BarView[];
  peak: string;
}

export interface MarkView {
  text: string;
  tone: 'warning' | 'good' | 'neutral' | 'accent';
}

export interface LineRowView {
  key: string;
  date: string;
  time: string;
  merchant: string;
  comment: string;
  person: string;
  personColor: string;
  account: string;
  marks: MarkView[];
  amount: string;
  refund: boolean;
  /** The operation's own amount when its currency differs, or the account currency's when it has no rate; '' — none. */
  original: string;
}

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
  /** The month has no line of the category; '' — it has. */
  none: ComputedRef<string>;
  months: ComputedRef<MonthsView | null>;
  people: ComputedRef<PersonView[]>;
  merchants: ComputedRef<MerchantView[]>;
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
