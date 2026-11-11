import type { ComputedRef, Ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import type { InsightSeverity, InsightsOverview, Standing } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import type { Loadable } from '@/shared/lib';
import type { ChangeChipModel } from '@/shared/ui';

/** One figure of «The month at a glance». `meter` — a running month: share of a usual month spent and of the month passed, 0–100. */
export interface GlanceView {
  key: 'spent' | 'income' | 'kept' | 'signals' | 'forecast';
  label: string;
  value: string;
  /** The value in each picked «Show also» currency; empty for a share or a count. */
  also: string[];
  note: string;
  tone: 'up' | 'down' | 'good' | 'bad' | 'neutral';
  meter: { value: number; mark: number } | null;
  /** The signals figure: its severities on one bar, high first, each with its count in words; absent elsewhere. */
  split?: GlanceSplitPart[] | null;
  /** The forecast figure: its range «from … to …» (null when both ends are equal) and the formula with the user's numbers. */
  range?: string | null;
  help?: { label: string; title: string; lines: string[] } | null;
}

/** One part of the signals bar: as wide as its count. */
export interface GlanceSplitPart {
  severity: InsightSeverity;
  count: number;
  text: string;
}

/** One bar of a card's chart: a usual month or the shown one, its height in % of the tallest. */
export interface InsightBarView {
  key: string;
  label: string;
  height: number;
  now: boolean;
  title: string;
}

export interface InsightBarsView {
  bars: InsightBarView[];
  /** The usual's line, % of the height. */
  usual: number;
  /** What the chart shows, for screen readers. */
  label: string;
}

export interface InsightCardView {
  key: string;
  icon: string;
  title: string;
  severity: InsightSeverity;
  severityLabel: string;
  text: string;
  chip: ChangeChipModel;
  /** The chip's amount in each picked «Show also» currency: «≈ +300 $». */
  also: string[];
  tone: 'up' | 'down' | 'neutral';
  bars: InsightBarsView | null;
  /** «Mostly …: +X, N% of the change»; null — no main driver. */
  driver: string | null;
  to: RouteLocationRaw | null;
  /** The link's text when it is not «Open operations» (a limit card opens the «Budget» screen). */
  linkText?: string;
}

/** A row of the side lists: a new payee or a one-off. */
export interface SignalRowView {
  key: string;
  icon: string;
  name: string;
  caption: string;
  amount: string;
  /** `amount` in each picked «Show also» currency. */
  also: string[];
  to: RouteLocationRaw | null;
}

/** A «?» explanation: what it means, then the formula with the user's numbers, then the guide. */
export interface HelpView {
  title: string;
  lines: string[];
}

/** One part of the income bar: its share, its width on the bar (0–100) and its colour. */
export interface BudgetPartView {
  key: 'essential' | 'wants' | 'left';
  label: string;
  share: string;
  width: number;
  color: string;
  guide: string;
  help: HelpView;
}

/** One row under the bar: fixed costs, loan payments, the reserve. */
export interface BudgetRowView {
  key: 'fixed' | 'debt' | 'reserve';
  label: string;
  value: string;
  guide: string;
  help: HelpView;
}

/** The «Budget structure» card. `note` — why the split is missing (a running month, no income). */
export interface BudgetCardView {
  parts: BudgetPartView[] | null;
  /** The 50/30/20 marks on the bar, % of its width. */
  marks: number[];
  note: string | null;
  rows: BudgetRowView[];
  basis: HelpView;
}

/** The two lines the health chart can show. */
export type ChartMetric = 'left' | 'wants';

/** The «Financial health» chart for one metric: a bar per month, null — no income that month. */
export interface HealthChartView {
  metric: ChartMetric;
  /** The switch's label. */
  tab: string;
  /** «How much of your income is left» and what it counts. */
  title: string;
  hint: string;
  points: Array<{ month: string; label: string; value: number | null; standing: Standing | null; unusual: 'above' | 'below' | null }>;
  /** The user's usual (median of the months shown) and its ± band; null — under 3 months with income. */
  usual: { value: number; low: number; high: number; text: string } | null;
  /** The running month's forecast as a hatched last bar; null — none. */
  forecast: { label: string; value: number; low: number; high: number; standing: Standing; text: string } | null;
  /** The three tiles above the chart. */
  tiles: HealthTileView[];
  /** The references in words: guide, usual, band, unusual months, forecast — those drawn. */
  references: Array<{ key: 'guide' | 'usual' | 'band' | 'unusual' | 'forecast'; text: string }>;
  /** The guide, per cent of income. */
  guide: number;
  guideText: string;
  /** The newest month: «−59%», its standing and a plain sentence; null — no month with income. */
  latest: { value: string; standing: Standing | null; sentence: string } | null;
  /** «5 mo. ago: −21%» — the first month with income; null — fewer than two. */
  before: string | null;
  /** What each colour means, then a line about bars below zero (the left share only). */
  legend: Array<{ standing: Standing; text: string }>;
  belowZero: string | null;
  /** The chart in words, for screen readers. */
  text: string;
}

/** A tile above the chart: a label, a value in words, a line under it. */
export interface HealthTileView {
  key: 'usual' | 'trend' | 'month';
  label: string;
  value: string;
  sub: string;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
  icon: string | null;
}

/** One checklist item: its figure, its guide and where it stands (null — nothing to place yet, `note` says why). */
export interface HealthItemView {
  /** `shares` — the five income shares as one row while there is no finished month with income. */
  key: 'shares' | 'left' | 'essential' | 'wants' | 'fixed' | 'debt' | 'reserve' | 'limits' | 'red' | 'income' | 'spending' | 'strong';
  label: string;
  value: string;
  guide: string;
  /** A share against the user's usual of it: «better than usual (36%)». */
  direction: { text: string; tone: 'good' | 'bad' | 'neutral' } | null;
  /** «Show»: the item points at the feed's high signals. */
  showSignals?: boolean;
  standing: Standing | null;
  standingText: string;
  note: string | null;
  help: HelpView;
}

/** The «Financial health» block (spec desktop-insights-health). */
export interface HealthView {
  /** Null — too little history for a chart. */
  chart: Record<ChartMetric, HealthChartView> | null;
  /** The income bar against 50/30/20 (a finished month with income), the checklist's help on «?», and the basis. */
  budget: BudgetCardView;
  /** The checklist in its three groups; an empty group is left out. */
  groups: Array<{ key: 'month' | 'cushion' | 'plans'; title: string; items: HealthItemView[] }>;
  /** «4 of 6»: items within the guide of those with a standing; null — none has one. */
  count: string | null;
}

/** What a feed item is, for the kind filter. */
export type FeedKind = 'up' | 'down' | 'income' | 'limits' | 'payees' | 'oneOffs';

/** The feed's filter: one choice per row, `all` — no filter. */
export interface FeedFilter {
  severity: 'all' | InsightSeverity;
  kind: 'all' | FeedKind;
}

/** A new payee or a one-off as a feed card. */
export interface SignalCardView extends SignalRowView {
  severity: InsightSeverity;
  severityLabel: string;
}

/** One item of the feed, ranked by `money` (the change, the overrun or the amount, kopecks). */
export type FeedItemView = { key: string; kind: FeedKind; severity: InsightSeverity; money: number } & (
  | { card: InsightCardView; signal: null }
  | { card: null; signal: SignalCardView }
);

export interface InsightsPageView {
  health: HealthView;
  glance: GlanceView[];
  /** Fewer than 3 whole months: the notice's text, and nothing else is shown below the glance. */
  early: string | null;
  /** Every item of the month, ranked by money: insights, limits, new payees, one-offs. */
  feed: FeedItemView[];
  /** There is a usual and the feed is empty. */
  calm: boolean;
  /** «How it was counted»: one sentence per line. */
  basis: string[];
}

export interface UseInsightsPageReturn {
  state: Readonly<Ref<Loadable<InsightsOverview>>>;
  view: ComputedRef<InsightsPageView | null>;
  fmt: ComputedRef<MoneyFormat>;
}
