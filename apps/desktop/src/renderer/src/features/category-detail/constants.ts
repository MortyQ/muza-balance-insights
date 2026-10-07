import type { DetailPeriod } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
/** Merchants named one by one; the rest is one «N more places» line. */
export const TOP_MERCHANTS = 8;

/** The period's own words: the figure's label, the rank, «no spending». */
export const PERIOD_TEXT = {
  day: { spent: 'category.summary.spentDay', rank: 'category.summary.rankDay', none: 'category.noneDay' },
  week: { spent: 'category.summary.spentWeek', rank: 'category.summary.rankWeek', none: 'category.noneWeek' },
  month: { spent: 'category.summary.spent', rank: 'category.summary.rank', none: 'category.none' },
} as const satisfies Record<DetailPeriod['kind'], { spent: MessageKey; rank: MessageKey; none: MessageKey }>;
