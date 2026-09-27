import type { ComputedRef, Ref } from 'vue';
import type { MonthOverview } from '@contract/api.ts';
import type { BalanceCardProps } from '@/entities/account';
import type { Loadable } from '@/shared/lib';

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
  /** Total cards: part of the income / spending is another currency counted in hryvnia by the user's own exchange rate. */
  approxIncome?: boolean;
  approxSpending?: boolean;
  /** Total cards: the rate line under the bars («вкл. 3 162 $ по курсу 44,36»); '' — none. */
  note?: string;
}

/** A card of the stack / row, in row order. */
export interface Slide extends BalanceCardProps {
  key: string;
  flow: Flow;
}

export interface LegendItem {
  participantId: number;
  label: string;
  color: string;
}

/** An answer with the person it was asked for (null — the family): labels come from here, not from the live choice. */
export interface TaggedOverview {
  participantId: number | null;
  overview: MonthOverview;
}

export interface UseMonthOverviewReturn {
  state: Readonly<Ref<Loadable<TaggedOverview>>>;
  view: ComputedRef<MonthOverview | null>;
  slides: ComputedRef<Slide[]>;
  /** The shown answer is the family view (no person). */
  isFamily: ComputedRef<boolean>;
  /** People of the family view with their colours; empty for a person. */
  legend: ComputedRef<LegendItem[]>;
  /** The shown answer's month: «Сентябрь», «Декабрь 2025». */
  monthName: ComputedRef<string>;
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
  next: () => void;
  showStub: () => void;
}
