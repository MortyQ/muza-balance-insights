import type { ComputedRef, Ref, WritableComputedRef } from 'vue';
import type { MonthOverview } from '@contract/api.ts';
import type { BalanceCardProps } from '@/entities/account';
import type { Loadable, YearMonth } from '@/shared/lib';

/** One part of a bar: a person's income and spending, in the bar's currency. */
export interface FlowSegment {
  color: string;
  income: number;
  spending: number;
}

/** «Пришло / Ушло» of one card, minor units of `currency`. */
export interface Flow {
  currency: number;
  income: number;
  spending: number;
  /** The single bar's colour (a person or an account). */
  color: string;
  /** The family: one part per person, in their colours. */
  segments?: ReadonlyArray<FlowSegment>;
}

/** A card of the stack / row, in row order. */
export interface Slide extends BalanceCardProps {
  key: string;
  flow: Flow;
}

export interface LegendItem {
  label: string;
  color: string;
}

export interface UseMonthOverviewReturn {
  state: Readonly<Ref<Loadable<MonthOverview>>>;
  view: ComputedRef<MonthOverview | null>;
  slides: ComputedRef<Slide[]>;
  /** The family view (no person selected). */
  isFamily: ComputedRef<boolean>;
  /** People of the family view with their colours; empty for a person. */
  legend: ComputedRef<LegendItem[]>;
  /** The selected month; setting it keeps it inside [first month with data, this month]. */
  month: WritableComputedRef<string>;
  /** «сентябрь 2026». */
  monthName: ComputedRef<string>;
  thisMonth: YearMonth;
  currentYear: number;
  /** The first month with data (Kyiv), or null while unknown. */
  firstMonth: ComputedRef<YearMonth | null>;
}

export interface UseCardStackReturn {
  open: Ref<boolean>;
  offset: Ref<number>;
  /** The last move was paging (arrows or a new month): the row slides without the stagger. */
  paging: Ref<boolean>;
  /** «Все счета» was pressed: the «later» note is shown. */
  stubShown: Ref<boolean>;
  toggle: () => void;
  close: () => void;
  prev: () => void;
  next: (n: number) => void;
  showStub: () => void;
}
