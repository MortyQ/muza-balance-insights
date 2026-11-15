import type { LimitsOverview, MonthBudgetView } from '@contract/api.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { limitLook } from '@/entities/goal';
import { formatMoney, monthName, t } from '@/shared/lib';
import type { AttentionLimitView, BudgetRowView, FixedChipView } from './types.ts';

/** «≈ 90 $ of 150 $» per picked «Show also» currency: a part of a whole, as `spentOf` says it in the main one. */
function alsoOf(fmt: MoneyFormat, part: number, whole: number): string[] {
  const wholes = fmt.alsoParts(whole);
  return fmt.alsoParts(part).map((p, i) =>
    `≈ ${t('entities.goal.spentOf', { spent: formatMoney(p.minor, p.currency), amount: formatMoney(wholes[i]!.minor, p.currency) })}`);
}

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
    totalAlso: fmt.alsoParts(b.total).filter((p) => p.currency !== b.currency).map((p) => `≈ ${formatMoney(p.minor, p.currency)}`),
    fixedTitle: t('home.budget.fixed', { paid: fmt.money(b.fixedPaid), amount: fmt.money(b.fixedTotal) }),
    fixedAlso: alsoOf(fmt, b.fixedPaid, b.fixedTotal),
    fixedPaid: b.fixedTotal > 0 ? Math.min(100, (b.fixedPaid / b.fixedTotal) * 100) : 100,
    fixed: b.fixed.map((r) => fixedChip(r, fmt)),
    flexibleTitle: t('home.budget.flexible', { spent: fmt.money(b.flexible.spent), amount: fmt.money(b.flexible.amount) }),
    flexibleAlso: alsoOf(fmt, b.flexible.spent, b.flexible.amount),
    flexible,
    excludedNote: b.excluded.length === 0 ? null : t('home.budget.excluded', { names: b.excluded.map((id) => categoryName({ category: id, categoryId: id })).join(', ') }),
    perDay: current ? { amount: flexible.perDay, also: fmt.approx(b.flexible.perDay), days: t('home.budget.daysLeft', b.flexible.daysLeft) } : null,
    result: b.result
      ? {
          within: b.result.within,
          text: b.result.within ? t('home.budget.within') : t('home.budget.over', { amount: fmt.money(-b.result.left) }),
          left: fmt.money(Math.max(0, b.result.left)),
          leftAlso: fmt.approx(Math.max(0, b.result.left)),
        }
      : null,
  };
}

/** Limits in attention or exceeded, in the overview's order (exceeded first). */
export function attentionLimits(v: LimitsOverview, fmt: MoneyFormat): AttentionLimitView[] {
  return v.limits.flatMap((l) =>
    l.figures && l.figures.state !== 'ok'
      ? [{ id: l.id, icon: CATEGORY_ICON[l.categoryId], name: categoryName({ category: l.categoryId, categoryId: l.categoryId }), look: limitLook(l.figures, fmt, v.current), also: alsoOf(fmt, l.figures.spent, l.figures.amount) }]
      : [],
  );
}
