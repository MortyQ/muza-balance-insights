import type { ComputedRef, Ref } from 'vue';
import type { MonthOverview } from '@contract/api.ts';
import type { AccountCardProps, SummaryCardProps } from '@/entities/account';
import type { MoneyFormat } from '@/entities/currency-display';
import type { Loadable } from '@/shared/lib';

/** One part of a bar: a person's income and spending, in the bar's currency. */
export interface FlowSegment {
  color: string;
  income: number;
  spending: number;
}

/** «In / Out» of one card, minor units of `currency`. */
export interface Flow {
  currency: number;
  income: number;
  spending: number;
  /** The single bar's colour (a person or an account). */
  color: string;
  /** The family: one part per person, in their colours. */
  segments?: ReadonlyArray<FlowSegment>;
  /** Total cards: part of the income / spending is another currency counted in at today's Monobank rate. */
  approxIncome?: boolean;
  approxSpending?: boolean;
  /** Total cards: the rate line under the bars («incl. 3 162 $ at the rate 44,36»); '' — none. */
  note?: string;
  /** Total cards: put into jars over the month (minus taken out), in `currency`; absent — no jar to tell. */
  saved?: { amount: number; approx: boolean };
  /** The total card of today: the reserves set against it, in `currency`; absent — none. */
  reserved?: number;
}

/** A card of the stack / row, in row order: the total of a view, or one account in its bank's look. */
export type Slide = ({ kind: 'summary'; card: SummaryCardProps } | { kind: 'account'; card: AccountCardProps }) & {
  key: string;
  flow: Flow;
};

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
  /** The shown answer's month: «September», «December 2025». */
  monthName: ComputedRef<string>;
}

/** The open row at its current scroll (`rowView`). */
export interface RowView {
  /** The cards wholly in view; the nearest card when none fits whole. */
  first: number;
  last: number;
  atStart: boolean;
  atEnd: boolean;
  /** Every card is in view: no scrolling, no fades, no dots. */
  fits: boolean;
}

export interface UseRowScrollReturn {
  view: ComputedRef<RowView>;
  prev: () => void;
  next: () => void;
  goTo: (i: number) => void;
  /** Back to the first card; resolves when the scroll has ended. `instant` — no smooth scrolling. */
  toStart: (instant?: boolean) => Promise<void>;
}

export interface UseDragScrollReturn {
  /** A mouse drag is moving the row: snapping is off until it ends. */
  dragging: Ref<boolean>;
}

export interface UseCardStackReturn {
  open: Ref<boolean>;
  /** A new month or person: the cards change in place, without the stagger. */
  paging: Ref<boolean>;
  /** «All accounts» was pressed: the «later» note is shown. */
  stubShown: Ref<boolean>;
  toggle: () => void;
  close: () => void;
  showStub: () => void;
}

/** The month pace (spec desktop-balance-cards, «Month pace»): hryvnia kopecks, one point per day of the month. */
export interface PaceView {
  /** Day of the month, as the axis shows it. */
  days: string[];
  /** Spending added up day by day; null — a day not reached yet (not drawn). */
  spent: Array<number | null>;
  /** The usual month's running spending by day; null — fewer than 3 whole months before. */
  usual: number[] | null;
  /** The last day with data: today while the month runs, the month's last day for a past month. */
  last: number;
  running: boolean;
  spentTotal: number;
  /** The usual spending by `last`; null without a usual month. */
  usualByNow: number | null;
  /** «Available per day»: the current month only. */
  perDay: number | null;
}

export interface UseMonthPaceReturn {
  view: ComputedRef<PaceView | null>;
  fmt: ComputedRef<MoneyFormat>;
}

/** The line under the stack: the free amount of the card in front, its reserve and the free share (null — no bar). */
export interface FreeLineView {
  free: string;
  negative: boolean;
  reserved: string | null;
  share: number | null;
}
