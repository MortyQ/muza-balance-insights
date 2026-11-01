import type { LimitsOverview, MonthBudgetView } from '@contract/api.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { limitLook } from '@/entities/goal';
import { formatMoney, monthName, t } from '@/shared/lib';
import type { AttentionLimitView, BudgetRowView, FixedChipView } from './types.ts';

function fixedChip(r: MonthBudgetView['fixed'][number], fmt: MoneyFormat): FixedChipView {
  const name = categoryName({ category: r.categoryId, categoryId: r.categoryId });
  const mark = r.paid >= r.amount ? '✓' : r.paid > 0 ? `${fmt.money(r.paid)} / ${fmt.money(r.amount)}` : '—';
  return { key: r.categoryId, name, mark, paid: r.paid >= r.amount };
}

/** The «Budget» row from the overview's budget; a past month gets the result instead of the pace. */
export function budgetRow(b: MonthBudgetView, month: string, current: boolean, fmt: MoneyFormat): BudgetRowView {
  const flexible = limitLook(b.flexible, fmt, current);
  return {
    title: t('home.budget.title', { month: monthName(Number(month.slice(5, 7))) }),
    total: formatMoney(b.amountMinor, b.currency),
    fixedTitle: t('home.budget.fixed', { paid: fmt.money(b.fixedPaid), amount: fmt.money(b.fixedTotal) }),
    fixedPaid: b.fixedTotal > 0 ? Math.min(100, (b.fixedPaid / b.fixedTotal) * 100) : 100,
    fixed: b.fixed.map((r) => fixedChip(r, fmt)),
    flexibleTitle: t('home.budget.flexible', { spent: fmt.money(b.flexible.spent), amount: fmt.money(b.flexible.amount) }),
    flexible,
    perDay: current ? { amount: flexible.perDay, days: t('home.budget.daysLeft', b.flexible.daysLeft) } : null,
    result: b.result
      ? {
          within: b.result.within,
          text: b.result.within ? t('home.budget.within') : t('home.budget.over', { amount: fmt.money(-b.result.left) }),
          left: fmt.money(Math.max(0, b.result.left)),
        }
      : null,
  };
}

/** Limits in attention or exceeded, in the overview's order (exceeded first). */
export function attentionLimits(v: LimitsOverview, fmt: MoneyFormat): AttentionLimitView[] {
  return v.limits.flatMap((l) =>
    l.figures && l.figures.state !== 'ok'
      ? [{ id: l.id, icon: CATEGORY_ICON[l.categoryId], name: categoryName({ category: l.categoryId, categoryId: l.categoryId }), look: limitLook(l.figures, fmt, v.current) }]
      : [],
  );
}
