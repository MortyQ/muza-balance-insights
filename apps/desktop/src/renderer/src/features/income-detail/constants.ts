import type { DetailPeriod } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

/** Senders named one by one; the rest is one «N more senders» line. */
export const TOP_SENDERS = 8;

/** The screen's colour: income, as the green of money coming in. */
export const INCOME_COLOR = 'var(--success)';

/** The period's own words: the figure's label, «no income». */
export const PERIOD_TEXT = {
  day: { received: 'income.summary.receivedDay', none: 'income.noneDay' },
  week: { received: 'income.summary.receivedWeek', none: 'income.noneWeek' },
  month: { received: 'income.summary.received', none: 'income.none' },
} as const satisfies Record<DetailPeriod['kind'], { received: MessageKey; none: MessageKey }>;
