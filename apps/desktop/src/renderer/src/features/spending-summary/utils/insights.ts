import type { SpendingOverview } from '@contract/api.ts';
import { categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { t } from '@/shared/lib';
import { INSIGHT_BASE, INSIGHT_MAX, INSIGHT_MIN, INSIGHT_SHARE } from '../constants.ts';
import type { InsightLine, InsightsView } from '../types.ts';

/** The share `now` is off `usual` by: 0.23 = 23% more; usual > 0. */
const offBy = (now: number, usual: number) => (now - usual) / usual;

/**
 * What is unusual in the shown month against `usual` (whole months). A month that is over: the categories off by at
 * least INSIGHT_MIN kopecks and INSIGHT_SHARE — over a usual under INSIGHT_BASE only more, said without a share; then
 * income, beside a category or when off itself. A running month: only the categories already over a whole usual month
 * by as much, no income (its day decides it). The largest differences first, at most INSIGHT_MAX. null — nothing
 * unusual, or no usual at all.
 */
export function insightsView(v: SpendingOverview, fmt: MoneyFormat): InsightsView | null {
  const u = v.usual;
  if (!u) return null;
  const now = new Map(v.categories.map((c) => [c.category, c.net]));
  const lines: InsightLine[] = u.categories
    .map((c) => ({ c, diff: (now.get(c.category) ?? 0) - c.net }))
    .filter(({ c, diff }) => {
      if (Math.abs(diff) < INSIGHT_MIN || Math.abs(offBy(c.net + diff, c.net)) < INSIGHT_SHARE) return false;
      return u.running || c.net < INSIGHT_BASE ? diff > 0 : true;
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || a.c.category.localeCompare(b.c.category))
    .slice(0, INSIGHT_MAX)
    .map(({ c, diff }) => {
      const more = diff > 0;
      const params = { name: categoryName(c), pct: Math.round(Math.abs(offBy(c.net + diff, c.net)) * 100), amount: fmt.money(Math.abs(diff)) };
      const key = u.running
        ? 'home.spending.insights.overMonth'
        : c.net < INSIGHT_BASE
          ? 'home.spending.insights.rare'
          : more
            ? 'home.spending.insights.more'
            : 'home.spending.insights.less';
      return { text: t(key, params), tone: more ? 'up' : 'down' };
    });

  const income = u.income && u.income.usual > 0 ? offBy(u.income.now, u.income.usual) : null;
  const incomeOff = income !== null && Math.abs(income) >= INSIGHT_SHARE;
  if (income !== null && (lines.length > 0 || incomeOff)) {
    const pct = Math.round(Math.abs(income) * 100);
    lines.push({
      text: !incomeOff
        ? t('home.spending.insights.incomeNormal')
        : t(income > 0 ? 'home.spending.insights.incomeMore' : 'home.spending.insights.incomeLess', { pct }),
      tone: 'neutral',
    });
  }
  if (lines.length === 0) return null;
  const months = t('home.spending.insights.months', u.months);
  return { lines, note: t(u.running ? 'home.spending.insights.noteRunning' : 'home.spending.insights.noteMonth', { months }) };
}
