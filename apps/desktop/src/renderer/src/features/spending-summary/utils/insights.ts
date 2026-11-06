import type { Scope, SpendingInsight, SpendingOverview } from '@contract/api.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { categoryLink } from '@/shared/config';
import { changeText, t } from '@/shared/lib';
import { BELOW_TOP_COLOR, CATEGORY_COLORS, INSIGHT_MAX } from '../constants.ts';
import type { InsightLine, InsightsView } from '../types.ts';

const KEY = {
  'category-more': 'home.spending.insights.more',
  'category-less': 'home.spending.insights.less',
  'category-rare': 'home.spending.insights.rare',
  'category-over-month': 'home.spending.insights.overMonth',
  'income-more': 'home.spending.insights.incomeMore',
  'income-less': 'home.spending.insights.incomeLess',
} as const;

/** Income's colour: the income screen's. */
const INCOME_COLOR = 'var(--success)';

/** The category's colour by its rank in «Spending» (`view.categories` is in the family's order), as its row has. */
function colorOf(i: SpendingInsight, v: SpendingOverview): string {
  if (i.category === null) return INCOME_COLOR;
  const rank = v.categories.findIndex((c) => c.category === i.category);
  return CATEGORY_COLORS[rank] ?? BELOW_TOP_COLOR;
}

function captionOf(i: SpendingInsight, fmt: MoneyFormat): string {
  const now = fmt.money(i.now);
  if (i.type === 'category-rare') return t('home.spending.insights.captionRare', { now });
  return t(i.type === 'category-over-month' ? 'home.spending.insights.captionOver' : 'home.spending.insights.caption', { now, usual: fmt.money(i.usual) });
}

function lineOf(i: SpendingInsight, v: SpendingOverview, fmt: MoneyFormat, scope: Scope): InsightLine {
  const diff = i.percent === null ? '' : changeText({ kind: i.direction, diff: i.amount, pct: i.percent }, fmt.money);
  const income = i.category === null;
  const name = i.category === null ? t('home.spending.insights.income') : categoryName({ category: i.category, categoryId: i.categoryId });
  const tone = income ? 'neutral' : i.direction;
  const sign = i.direction === 'up' ? '+' : '−';
  const top = Math.max(i.now, i.usual, 1);
  return {
    text: t(KEY[i.type], { name, diff, amount: fmt.money(i.amount) }),
    tone,
    to: i.categoryId ? categoryLink(i.categoryId, scope) : null,
    name,
    icon: income ? 'lucide:wallet' : CATEGORY_ICON[i.categoryId ?? 'other'],
    color: colorOf(i, v),
    caption: captionOf(i, fmt),
    chip: {
      text: i.percent === null ? `${sign}${fmt.money(i.amount)}` : changeText({ kind: i.direction, diff: i.amount, pct: i.percent }, fmt.money, true),
      tone,
      arrow: income ? null : i.direction,
      sr: '',
    },
    bar: { value: (i.now / top) * 100, mark: (i.usual / top) * 100 },
  };
}

/**
 * «What's unusual» from core's detectors (`SpendingOverview.insights`, already ranked by money): the first INSIGHT_MAX,
 * each as a row like «Spending»'s — the category's icon in its colour, now and the usual, the change, a bar of now
 * against the usual; a category line opens its screen. null — no usual, or nothing unusual.
 */
export function insightsView(v: SpendingOverview, fmt: MoneyFormat, scope: Scope): InsightsView | null {
  const found = v.insights;
  if (!found || found.insights.length === 0) return null;
  const months = t('home.spending.insights.months', found.months);
  return {
    lines: found.insights.slice(0, INSIGHT_MAX).map((i) => lineOf(i, v, fmt, scope)),
    note: t(found.running ? 'home.spending.insights.noteRunning' : 'home.spending.insights.noteMonth', { months }),
  };
}
