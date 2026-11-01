import type { ComputedRef, Ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import type { InsightSeverity, InsightsOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import type { Loadable } from '@/shared/lib';
import type { ChangeChipModel } from '@/shared/ui';

/** One figure of «The month at a glance». `meter` — a running month: share of a usual month spent and of the month passed, 0–100. */
export interface GlanceView {
  key: 'spent' | 'income' | 'kept' | 'signals';
  label: string;
  value: string;
  note: string;
  tone: 'up' | 'down' | 'good' | 'bad' | 'neutral';
  meter: { value: number; mark: number } | null;
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
  tone: 'up' | 'down' | 'neutral';
  bars: InsightBarsView | null;
  /** «Mostly …: +X, N% of the change»; null — no main driver. */
  driver: string | null;
  to: RouteLocationRaw | null;
}

/** A row of the side lists: a new payee or a one-off. */
export interface SignalRowView {
  key: string;
  icon: string;
  name: string;
  caption: string;
  amount: string;
  to: RouteLocationRaw | null;
}

export interface InsightsPageView {
  glance: GlanceView[];
  /** Fewer than 3 whole months: the notice's text, and nothing else is shown below the glance. */
  early: string | null;
  cards: InsightCardView[];
  /** There is a usual and nothing is unusual. */
  calm: boolean;
  newPayees: SignalRowView[];
  oneOffs: SignalRowView[];
  /** «How it was counted»: one sentence per line. */
  basis: string[];
}

export interface UseInsightsPageReturn {
  state: Readonly<Ref<Loadable<InsightsOverview>>>;
  view: ComputedRef<InsightsPageView | null>;
  fmt: ComputedRef<MoneyFormat>;
}
