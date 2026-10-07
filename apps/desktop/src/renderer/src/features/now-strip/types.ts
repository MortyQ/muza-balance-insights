import type { ComputedRef } from 'vue';
import type { ChangeChipModel } from '@/shared/ui';

export interface WeekBar {
  kind: 'past' | 'today' | 'future';
  /** % of the week's largest day; 0 — a stub. */
  height: number;
}

export interface TodayCell {
  title: string;
  amount: string;
  ops: string;
  /** «≈ 15 $ · 13 €»; '' — no currency on. */
  conv: string;
  chip: ChangeChipModel | null;
  /** `home.now.vsUsual`; '' — no usual day. */
  context: string;
  /** `home.now.until` when the data does not reach today; ''. */
  until: string;
}

export interface WeekCell {
  title: string;
  amount: string;
  conv: string;
  chip: ChangeChipModel | null;
  /** `home.now.vsWeek`; '' — no comparison. */
  context: string;
  bars: WeekBar[];
  pending: number;
}

export interface TopCell {
  name: string;
  color: string;
  amount: string;
  caption: string;
}

export type NowPeriod = 'today' | 'week';

export interface CategoryRow {
  /** The core's category word: unique in a period. */
  key: string;
  name: string;
  color: string;
  amount: string;
  ops: string;
  /** % of the period's net, 0–100. */
  share: number;
  /** Against the same days last week (the week only); null — none. */
  chip: ChangeChipModel | null;
}

export interface CategoryBreakdown {
  rows: CategoryRow[];
  /** «3 категории · 865 ₴ · 5 операций»; '' — no spending. */
  summary: string;
  /** `home.now.cats.vsWeek` under the week's list; '' — no comparison. */
  note: string;
}

export interface NowStripView {
  today: TodayCell;
  week: WeekCell;
  /** null — no spending this week. */
  top: TopCell | null;
  categories: Record<NowPeriod, CategoryBreakdown>;
}

/** The panel's choices, remembered on this computer. */
export interface NowPrefs {
  open: boolean;
  period: NowPeriod;
}

export interface UseNowStripReturn {
  /** Data loaded and the month filter on this month. */
  visible: ComputedRef<boolean>;
  view: ComputedRef<NowStripView | null>;
}
