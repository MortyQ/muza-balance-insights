import type { ChangeChipModel } from '@/shared/ui';
import type { SORTS } from './constants.ts';

export type SortKey = (typeof SORTS)[number];

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
  /** The average written on its line («avg 9 000 ₴»); '' — no average. */
  avgLabel: string;
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

/** A row of a list that filters the operations (a merchant, a sender). */
export interface ShareItemView {
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
  /** «When», or «When: Uklon» while the list is filtered by one name. */
  title: string;
  /** null — not shown for this period (one day). */
  weekdays: BarView[] | null;
  dayParts: DayPartView[];
  /** null — not shown for this period (a day, a week). */
  days: BarView[] | null;
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
  /** The line's text: a merchant, a sender. */
  merchant: string;
  comment: string;
  person: string;
  personColor: string;
  account: string;
  marks: MarkView[];
  amount: string;
  /** Money coming in (a refund, income): shown green. */
  incoming: boolean;
  /** The operation's own amount when its currency differs, or the account currency's when it has no rate; '' — none. */
  original: string;
}

/** What «When» reads of a line (system time zone): ISO weekday, HH:mm, YYYY-MM-DD. */
export interface WhenLine {
  weekday: number;
  time: string;
  date: string;
}

/** A person in the screens' words: the global filter's people. */
export interface PersonRef {
  id: number;
  name: string;
  color: string;
}

/** How an amount is written: the home-wide currency choice (MoneyFormat of entities/currency-display fits). */
export interface Money {
  money(kopecks: number): string;
}

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
  /** A small line under the figure (charged and refunded); '' — none. */
  note: string;
  stats: StatView[];
}
