import type { GoalCurrency, LimitsOverview, MonthBudgetView, RatesView } from '@contract/api.ts';
import type { KindCategoryId } from '@contract/categories.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { limitLook } from '@/entities/goal';
import { formatMoney, monthName, t, UAH } from '@/shared/lib';
import type { BudgetPanelView, FixedRowView, LimitRowView, LimitsScreenView } from './types.ts';

export const nameOf = (id: KindCategoryId) => categoryName({ category: id, categoryId: id });

/** Kopecks per minor unit of a goal currency; hryvnia 1; null — no rate. */
export function rateOf(rates: RatesView | null, currency: GoalCurrency): number | null {
  if (currency === UAH) return 1;
  return rates?.list.find((r) => r.currency === currency)?.rate ?? null;
}

/** Hryvnia kopecks → minor units of `currency` (null without a rate). */
export function fromUah(kopecks: number, currency: GoalCurrency, rates: RatesView | null): number | null {
  const r = rateOf(rates, currency);
  return r === null ? null : Math.round(kopecks / r);
}

const money = (minor: number, currency: number) => formatMoney(minor, currency);

function fixedRow(r: MonthBudgetView['fixed'][number], fmt: MoneyFormat): FixedRowView {
  return {
    categoryId: r.categoryId,
    name: nameOf(r.categoryId),
    icon: CATEGORY_ICON[r.categoryId],
    paidOf: t('limits.budget.paidOf', { paid: fmt.money(r.paid), amount: fmt.money(r.amount) }),
    paid: r.paid >= r.amount ? 'yes' : r.paid > 0 ? 'part' : 'no',
  };
}

export function budgetPanel(b: MonthBudgetView, month: string, current: boolean, fmt: MoneyFormat): BudgetPanelView {
  const flexibleAmount = b.flexible.amount;
  return {
    id: b.id,
    title: t('limits.budget.title', { month: monthName(Number(month.slice(5, 7))) }),
    total: money(b.amountMinor, b.currency),
    fixed: b.fixed.map((r) => fixedRow(r, fmt)),
    fixedSummary: t('limits.budget.fixedSummary', { paid: fmt.money(b.fixedPaid), amount: fmt.money(b.fixedTotal) }),
    fixedTakesAll: b.fixedTakesAll,
    flexibleTitle: t('limits.budget.flexibleOf', { amount: fmt.money(flexibleAmount) }),
    flexible: limitLook(b.flexible, fmt, current),
    result: b.result
      ? {
          within: b.result.within,
          text: b.result.within
            ? t('limits.budget.within', { amount: fmt.money(b.result.left) })
            : t('limits.budget.over', { amount: fmt.money(-b.result.left) }),
        }
      : null,
    help: {
      title: t('limits.budget.helpTitle'),
      lines: [
        t('limits.budget.help'),
        t('limits.budget.helpFormula', { total: fmt.money(b.total), fixed: fmt.money(b.fixedTotal), flexible: fmt.money(flexibleAmount) }),
        t('limits.budget.helpOver'),
        t('limits.budget.helpCounted'),
      ],
    },
  };
}

/** The «Budget» screen from one answer; `ownerName` — whose a plan is, in a view of several people (null — not said). */
export function limitsScreenView(v: LimitsOverview, fmt: MoneyFormat, ownerName: (id: number | null) => string | null): LimitsScreenView {
  const limits: LimitRowView[] = v.limits.map((l) => ({
    id: l.id,
    categoryId: l.categoryId,
    icon: CATEGORY_ICON[l.categoryId],
    name: nameOf(l.categoryId),
    period: l.period,
    periodText: t(`limits.period.${l.period}`),
    owner: ownerName(l.owner),
    look: l.figures ? limitLook(l.figures, fmt, v.current) : null,
  }));
  return {
    current: v.current,
    monthTitle: monthName(Number(v.month.slice(5, 7))),
    budget: v.budget ? budgetPanel(v.budget, v.month, v.current, fmt) : null,
    limits,
    suggestions: v.limits.length === 0 ? v.suggestions.map((s) => ({ categoryId: s.categoryId, name: nameOf(s.categoryId), amount: fmt.money(s.amount) })) : [],
    early: v.past.months.length < 3,
  };
}

const median = (xs: ReadonlyArray<number>) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** A typical whole amount in `currency` from kopecks: rounded to 100 units; null without a rate or history. */
export function roundUnits(kopecks: number, currency: GoalCurrency, rates: RatesView | null): number | null {
  const minor = fromUah(kopecks, currency, rates);
  if (minor === null || minor <= 0) return null;
  return Math.max(100, Math.round(minor / 100 / 100) * 100);
}

/** The usual month of all spending (median of the whole months), in whole units of `currency`. */
export function usualTotal(v: LimitsOverview, currency: GoalCurrency): number | null {
  return v.past.total.length >= 3 ? roundUnits(median(v.past.total), currency, v.rates) : null;
}

/** Past whole months' flexible spending — all but the listed fixed categories and savings —, minor units of `currency`. */
export function pastFlexible(v: LimitsOverview, fixed: ReadonlyArray<KindCategoryId>, currency: GoalCurrency): Array<{ month: string; minor: number }> {
  const savings = v.kinds.filter((k) => k.kind === 'savings').map((k) => k.categoryId);
  const out = new Set<KindCategoryId>([...fixed, ...savings]);
  return v.past.months.flatMap((month, i) => {
    const kopecks = v.past.total[i]! - [...out].reduce((s, id) => s + (v.past.byCategory[id]?.[i] ?? 0), 0);
    const minor = fromUah(kopecks, currency, v.rates);
    return minor === null ? [] : [{ month, minor: Math.max(0, minor) }];
  });
}

/** A category's past whole months in minor units of `currency`, scaled to a week or a day for those periods. */
export function pastOf(v: LimitsOverview, id: KindCategoryId, period: 'day' | 'week' | 'month', currency: GoalCurrency): Array<{ month: string; minor: number }> {
  const scale = period === 'month' ? 1 : period === 'week' ? 7 / 30.44 : 1 / 30.44;
  return v.past.months.flatMap((month, i) => {
    const minor = fromUah((v.past.byCategory[id]?.[i] ?? 0) * scale, currency, v.rates);
    return minor === null ? [] : [{ month, minor }];
  });
}
