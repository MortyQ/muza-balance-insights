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

export interface NowStripView {
  today: TodayCell;
  week: WeekCell;
  /** null — no spending this week. */
  top: TopCell | null;
}

export interface UseNowStripReturn {
  /** Data loaded and the month filter on this month. */
  visible: ComputedRef<boolean>;
  view: ComputedRef<NowStripView | null>;
}
