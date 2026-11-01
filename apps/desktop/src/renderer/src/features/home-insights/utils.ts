import type { Scope, SpendingOverview } from '@contract/api.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { categoryLink } from '@/shared/config';
import { monthShortName, t } from '@/shared/lib';
import type { HomeInsightsView } from './types.ts';

/** «2025-09» → «Sep 2025». */
function monthText(ym: string): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return `${monthShortName(m)} ${y}`;
}

/** A whole percent with a real minus sign. */
const percent = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n)}%`;

/**
 * Home's «Insights» block from `SpendingOverview.explain`: driver rows in the order of «What's unusual», a finished
 * month's savings rate, and the note. null — nothing to show besides the note.
 */
export function homeInsightsView(v: SpendingOverview, fmt: MoneyFormat, scope: Scope): HomeInsightsView | null {
  const e = v.explain;
  if (!e || (e.drivers.length === 0 && !e.savings)) return null;
  return {
    drivers: e.drivers.map((d) => {
      const category = categoryName({ category: d.category, categoryId: d.categoryId });
      return {
        key: d.category,
        icon: CATEGORY_ICON[d.categoryId ?? 'rest'],
        name: d.name,
        caption: t('home.insights.share', { category, share: d.share }),
        amount: `${d.direction === 'up' ? '+' : '−'}${fmt.money(d.amount)}`,
        tone: d.direction,
        to: d.categoryId ? categoryLink(d.categoryId, scope) : null,
      };
    }),
    savings: e.savings && {
      title: t(e.savings.rate < 0 ? 'home.insights.savings.over' : 'home.insights.savings.title'),
      value: percent(e.savings.rate),
      usual: t('home.insights.savings.usual', { usual: percent(e.savings.usual) }),
      over: e.savings.rate < 0,
    },
    note: t('home.insights.note', {
      months: t('home.insights.months', e.basis.months),
      from: monthText(e.basis.from),
      to: monthText(e.basis.to),
    }),
    pending: e.basis.pendingHolds > 0 ? t('home.insights.pending', e.basis.pendingHolds) : null,
  };
}
