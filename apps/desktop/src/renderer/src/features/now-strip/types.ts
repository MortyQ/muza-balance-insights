import type { ComputedRef } from 'vue';
import type { categoryLink } from '@/shared/config';
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
  /** % of the period's biggest category, 0–100: the row's bar in the tiles. */
  bar: number;
  icon: string;
  /** Against the same days last week (the week only); null — none. */
  chip: ChangeChipModel | null;
  /** The category's screen for this day or week; null — a category the app does not know. */
  to: ReturnType<typeof categoryLink> | null;
}

export interface CategoryBreakdown {
  rows: CategoryRow[];
  /** «3 категории · 865 ₴ · 5 операций»; '' — no spending. */
  summary: string;
  /** `home.now.cats.vsWeek` under the week's list; '' — no comparison. */
  note: string;
  /** «9 more categories · 1 830 ₴» for the rows a tile does not list (`SHOWN_CATEGORIES`); '' — none. */
  more: string;
}

export interface NowStripView {
  today: TodayCell;
  week: WeekCell;
  categories: Record<NowPeriod, CategoryBreakdown>;
}

/** The panel's choices, remembered on this computer. */
export interface NowPrefs {
  period: NowPeriod;
}

export interface UseNowStripReturn {
  /** Data loaded and the month filter on this month. */
  visible: ComputedRef<boolean>;
  view: ComputedRef<NowStripView | null>;
}
