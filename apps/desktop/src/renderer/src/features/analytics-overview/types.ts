import type { ComputedRef, Ref } from 'vue';
import type { AnalyticsBucketState, AnalyticsOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import type { Loadable } from '@/shared/lib';

export type ViewId = 'heat' | 'small' | 'lines' | 'compare';
export type LinesMode = 'amount' | 'share';

/** One row of the heatmap, the small charts and the lines: one category with spending in the period. */
export type CategoryRow = { key: string; name: string; color: string; net: number[]; total: number; prev: number | null };

/** A column of the heatmap: one month, or one calendar week clipped to the month. `days` — the days it has data for. */
export type Column = { label: string; idx: number[]; days: number; state: AnalyticsBucketState };

export type HeatCell = { text: string; title: string; background: string; strong: boolean; running: boolean };
export type HeatRow = { key: string; name: string; color: string; avg: string; cells: HeatCell[] };

export type KpiView = { key: 'income' | 'spending' | 'left' | 'rate'; label: string; value: string; note: string; tone: 'good' | 'bad' | 'neutral' };
export type ChangeRow = { key: string; name: string; delta: string; pct: string; why: string; up: boolean };
export type CompareRow = { key: string; name: string; left: number; width: number; up: boolean; delta: string; span: string };
export type MiniCard = { key: string; name: string; color: string; total: string; avg: string; chip: string; up: boolean | null };
export type GapPolygon = { points: Array<[number, number]>; positive: boolean };

export interface UseAnalyticsReturn {
  state: Ref<Loadable<AnalyticsOverview>>;
  view: ComputedRef<AnalyticsOverview | null>;
  rows: ComputedRef<CategoryRow[]>;
  fmt: ComputedRef<MoneyFormat>;
  current: Ref<ViewId>;
  on: Ref<ReadonlySet<string>>;
  hover: Ref<string | null>;
  mode: Ref<LinesMode>;
  /** «What changed» → «Lines» with that category alone. */
  showOnly: (key: string) => void;
  toggle: (key: string) => void;
  top: () => void;
  all: () => void;
}
