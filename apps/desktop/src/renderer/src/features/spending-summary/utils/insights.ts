import type { Scope, SpendingInsight, SpendingOverview } from '@contract/api.ts';
import { categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { categoryLink } from '@/shared/config';
import { changeText, t } from '@/shared/lib';
import { INSIGHT_MAX } from '../constants.ts';
import type { InsightLine, InsightsView } from '../types.ts';

const KEY = {
  'category-more': 'home.spending.insights.more',
  'category-less': 'home.spending.insights.less',
  'category-rare': 'home.spending.insights.rare',
  'category-over-month': 'home.spending.insights.overMonth',
  'income-more': 'home.spending.insights.incomeMore',
  'income-less': 'home.spending.insights.incomeLess',
} as const;

function lineOf(i: SpendingInsight, fmt: MoneyFormat, scope: Scope): InsightLine {
  const diff = i.percent === null ? '' : changeText({ kind: i.direction, diff: i.amount, pct: i.percent }, fmt.money);
  const name = i.category === null ? '' : categoryName({ category: i.category, categoryId: i.categoryId });
  return {
    text: t(KEY[i.type], { name, diff, amount: fmt.money(i.amount) }),
    tone: i.category === null ? 'neutral' : i.direction,
    to: i.categoryId ? categoryLink(i.categoryId, scope) : null,
  };
}

/**
 * «What's unusual» from core's detectors (`SpendingOverview.insights`, already ranked by money): the first INSIGHT_MAX,
 * worded; a category line opens its screen. null — no usual, or nothing unusual.
 */
export function insightsView(v: SpendingOverview, fmt: MoneyFormat, scope: Scope): InsightsView | null {
  const found = v.insights;
  if (!found || found.insights.length === 0) return null;
  const months = t('home.spending.insights.months', found.months);
  return {
    lines: found.insights.slice(0, INSIGHT_MAX).map((i) => lineOf(i, fmt, scope)),
    note: t(found.running ? 'home.spending.insights.noteRunning' : 'home.spending.insights.noteMonth', { months }),
  };
}
