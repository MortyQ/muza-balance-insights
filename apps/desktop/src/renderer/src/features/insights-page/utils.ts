import type { BudgetStructureView, InsightCardView as InsightCard, InsightsOverview, NewPayeeView, OneOffView, Scope } from '@contract/api.ts';
import type { CategoryId } from '@contract/categories.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { categoryLink, incomeLink } from '@/shared/config';
import { change, changeText, dayMonthName, i18n, monthName, monthShortName, t } from '@/shared/lib';
import type { BudgetCardView, BudgetPartView, BudgetRowView, GlanceView, InsightBarsView, InsightCardView, InsightsPageView, SignalRowView } from './types.ts';

const monthNo = (ym: string) => Number(ym.slice(5, 7));

/** «2025-09» → «Sep 2025». */
const monthText = (ym: string) => `${monthShortName(monthNo(ym))} ${ym.slice(0, 4)}`;

/** A whole percent with a real minus sign. */
const percent = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n)}%`;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function spentGlance(v: InsightsOverview, fmt: MoneyFormat): GlanceView {
  const base = { key: 'spent', label: t('insights.glance.spent'), value: fmt.money(v.spent) } as const;
  const u = v.usual;
  if (!u || u.total <= 0) return { ...base, note: '', tone: 'neutral', meter: null };
  if (v.period.incomplete) {
    const share = clamp((v.spent / u.total) * 100);
    const passed = clamp((v.period.coveredDays / v.period.days) * 100);
    return { ...base, note: t('insights.glance.ofUsual', { share, passed }), tone: share > passed ? 'up' : 'neutral', meter: { value: share, mark: passed } };
  }
  const c = change(v.spent, u.total);
  if (!c || c.kind === 'same' || c.kind === 'new') return { ...base, note: t('insights.glance.asUsual', { usual: fmt.money(u.total) }), tone: 'neutral', meter: null };
  return {
    ...base,
    note: t(c.kind === 'up' ? 'insights.glance.above' : 'insights.glance.below', { diff: changeText(c, fmt.money), usual: fmt.money(u.total) }),
    tone: c.kind,
    meter: null,
  };
}

function incomeGlance(v: InsightsOverview, fmt: MoneyFormat): GlanceView {
  const label = t('insights.glance.income');
  const income = v.usual?.income;
  if (!income) return { key: 'income', label, value: '—', note: t(v.period.incomplete ? 'insights.glance.monthEnd' : 'insights.glance.noUsual'), tone: 'neutral', meter: null };
  const c = change(income.now, income.usual);
  const note =
    !c || c.kind === 'same' || c.kind === 'new'
      ? t('insights.glance.asUsual', { usual: fmt.money(income.usual) })
      : t(c.kind === 'up' ? 'insights.glance.above' : 'insights.glance.below', { diff: changeText(c, fmt.money), usual: fmt.money(income.usual) });
  return { key: 'income', label, value: fmt.money(income.now), note, tone: 'neutral', meter: null };
}

function keptGlance(v: InsightsOverview): GlanceView {
  const label = t('insights.glance.kept');
  const s = v.usual?.savings;
  if (!s) {
    const why = v.period.incomplete ? 'insights.glance.monthEnd' : 'insights.glance.noSavings';
    return { key: 'kept', label, value: '—', note: t(why), tone: 'neutral', meter: null };
  }
  return { key: 'kept', label, value: percent(s.rate), note: t('insights.glance.usually', { usual: percent(s.usual) }), tone: s.rate >= s.usual ? 'good' : 'bad', meter: null };
}

function signalsGlance(v: InsightsOverview): GlanceView {
  const by = (s: string) => v.cards.filter((c) => c.severity === s).length;
  const parts = [
    by('high') > 0 ? t('insights.severity.countHigh', by('high')) : '',
    by('medium') > 0 ? t('insights.severity.countMedium', by('medium')) : '',
    by('low') > 0 ? t('insights.severity.countLow', by('low')) : '',
  ].filter(Boolean);
  return {
    key: 'signals',
    label: t('insights.glance.signals'),
    value: v.usual ? String(v.cards.length) : '—',
    note: v.usual ? (parts.length > 0 ? parts.join(' · ') : t('insights.glance.noSignals')) : '',
    tone: by('high') > 0 ? 'up' : 'neutral',
    meter: null,
  };
}

/** The usual months and the shown one on one scale, the usual (median) as a line. */
export function barsView(c: InsightCard, fmt: MoneyFormat): InsightBarsView | null {
  if (c.series.length === 0) return null;
  const max = Math.max(1, c.usual, ...c.series.map((s) => s.value));
  const shown = c.series.at(-1)!.month;
  return {
    bars: c.series.map((s) => ({
      key: s.month,
      label: monthShortName(monthNo(s.month)),
      height: s.value > 0 ? Math.max(4, (s.value / max) * 100) : 0,
      now: s.month === shown,
      title: `${monthName(monthNo(s.month))} ${s.month.slice(0, 4)} — ${fmt.money(Math.max(0, s.value))}`,
    })),
    usual: (c.usual / max) * 100,
    label: t('insights.card.chart', { usual: fmt.money(c.usual) }),
  };
}

const CARD_TEXT = {
  'category-more': 'insights.card.more',
  'category-less': 'insights.card.less',
  'category-rare': 'insights.card.rare',
  'category-over-month': 'insights.card.overMonth',
  'income-more': 'insights.card.incomeMore',
  'income-less': 'insights.card.incomeLess',
} as const;

export function cardView(c: InsightCard, fmt: MoneyFormat, scope: Scope): InsightCardView {
  const income = c.category === null;
  const sign = c.direction === 'up' ? '+' : '−';
  const tone = income ? 'neutral' : c.direction;
  return {
    key: c.category ?? 'income',
    icon: income ? 'lucide:wallet' : CATEGORY_ICON[c.categoryId ?? 'rest'],
    title: income ? t('insights.card.income') : categoryName({ category: c.category!, categoryId: c.categoryId }),
    severity: c.severity,
    severityLabel: t(`insights.severity.${c.severity}`),
    text: t(CARD_TEXT[c.type], { now: fmt.money(c.now), usual: fmt.money(c.usual) }),
    chip: {
      text: c.percent === null ? `${sign}${fmt.money(c.amount)}` : `${sign}${changeText({ kind: c.direction, diff: c.amount, pct: c.percent }, fmt.money)}`,
      tone,
      arrow: c.direction,
      sr: '',
    },
    tone,
    bars: barsView(c, fmt),
    driver: c.driver ? t('insights.card.driver', { name: c.driver.name, amount: `${sign}${fmt.money(c.driver.amount)}`, share: c.driver.share }) : null,
    to: income ? incomeLink() : c.categoryId ? categoryLink(c.categoryId, scope) : null,
  };
}

function payeeRow(p: NewPayeeView, fmt: MoneyFormat, scope: Scope): SignalRowView {
  return {
    key: p.name,
    icon: CATEGORY_ICON[p.categoryId ?? 'rest'],
    name: p.name,
    caption: categoryName(p),
    amount: fmt.money(p.amount),
    to: p.categoryId ? categoryLink(p.categoryId, scope) : null,
  };
}

function oneOffRow(o: OneOffView, fmt: MoneyFormat, scope: Scope, year: number): SignalRowView {
  const category = categoryName(o);
  return {
    key: o.key,
    icon: CATEGORY_ICON[o.categoryId ?? 'rest'],
    name: o.name || category,
    caption: `${dayMonthName(o.date, year)} · ${category}`,
    amount: fmt.money(o.amount),
    to: o.categoryId ? categoryLink(o.categoryId, scope) : null,
  };
}

function basisLines(v: InsightsOverview): string[] {
  const u = v.usual!;
  return [
    t('insights.basis.usual', { months: t('insights.basis.months', u.months), from: monthText(u.from), to: monthText(u.to) }),
    t('insights.basis.excluded'),
    t('insights.basis.threshold'),
    t('insights.basis.severity'),
    ...(v.period.incomplete ? [t('insights.basis.running')] : []),
    ...(v.period.pendingHolds > 0 ? [t('insights.basis.pending', v.period.pendingHolds)] : []),
  ];
}

const names = (ids: ReadonlyArray<CategoryId>) => ids.map((id) => categoryName({ category: id, categoryId: id })).join(', ');

/** «2,4 months», one decimal, in the app language's way. */
const monthsText = (n: number) => t('insights.budget.reserveValue', { n: new Intl.NumberFormat(i18n.global.locale.value, { maximumFractionDigits: 1 }).format(n) });

/**
 * The «Budget structure» card: a finished month's income split against 50/30/20, the fixed and loan shares and the
 * reserve, each with a «?» that gives the formula with the user's numbers and the guide as common advice.
 */
export function budgetView(b: BudgetStructureView, incomplete: boolean, fmt: MoneyFormat): BudgetCardView {
  const m = b.month;
  const parts: BudgetPartView[] | null = m
    ? (() => {
        const left = m.income - m.essential - m.wants;
        const total = Math.max(m.income, m.essential + m.wants);
        const width = (x: number) => (total > 0 ? Math.max(0, (x / total) * 100) : 0);
        return [
          {
            key: 'essential', label: t('entities.categoryKind.essential'), share: percent(m.split.essential), width: width(m.essential), color: 'var(--kind-essential)',
            guide: t('insights.budget.guideShare', { n: 50 }),
            help: { title: t('entities.categoryKind.essential'), lines: [
              t('insights.budget.help.essential'),
              t('insights.budget.help.shareOf', { amount: fmt.money(m.essential), income: fmt.money(m.income), share: percent(m.split.essential) }),
              t('insights.budget.help.guide', { n: 50 }),
            ] },
          },
          {
            key: 'wants', label: t('entities.categoryKind.wants'), share: percent(m.split.wants), width: width(m.wants), color: 'var(--kind-wants)',
            guide: t('insights.budget.guideShare', { n: 30 }),
            help: { title: t('entities.categoryKind.wants'), lines: [
              t('insights.budget.help.wants'),
              t('insights.budget.help.shareOf', { amount: fmt.money(m.wants), income: fmt.money(m.income), share: percent(m.split.wants) }),
              t('insights.budget.help.guide', { n: 30 }),
            ] },
          },
          {
            key: 'left', label: t('insights.budget.left'), share: percent(m.split.left), width: width(Math.max(0, left)), color: 'var(--kind-left)',
            guide: t('insights.budget.guideShare', { n: 20 }),
            help: { title: t('insights.budget.left'), lines: [
              t('insights.budget.help.left'),
              t('insights.budget.help.leftFormula', { income: fmt.money(m.income), essential: fmt.money(m.essential), wants: fmt.money(m.wants), left: `${left < 0 ? '−' : ''}${fmt.money(Math.abs(left))}`, share: percent(m.split.left) }),
              t('insights.budget.help.guide', { n: 20 }),
            ] },
          },
        ];
      })()
    : null;
  const rows: BudgetRowView[] = [];
  if (m) {
    rows.push({
      key: 'fixed', label: t('insights.budget.fixed'), value: percent(m.fixedShare), guide: t('insights.budget.fixedGuide'),
      help: { title: t('insights.budget.fixed'), lines: [
        t('insights.budget.help.fixed'),
        t('insights.budget.help.shareOf', { amount: fmt.money(m.fixed), income: fmt.money(m.income), share: percent(m.fixedShare) }),
        t('insights.budget.fixedGuide'),
      ] },
    });
    rows.push({
      key: 'debt', label: t('insights.budget.debt'), value: percent(m.debtShare), guide: t('insights.budget.debtGuide'),
      help: { title: t('insights.budget.debt'), lines: [
        t('insights.budget.help.debt'),
        t('insights.budget.help.shareOf', { amount: fmt.money(m.debt), income: fmt.money(m.income), share: percent(m.debtShare) }),
        t('insights.budget.debtGuide'),
      ] },
    });
  }
  const r = b.reserve;
  rows.push({
    key: 'reserve', label: t('insights.budget.reserve'), value: r ? monthsText(r.months) : '—', guide: r ? t('insights.budget.reserveGuide') : t('insights.budget.reserveNone'),
    help: { title: t('insights.budget.reserve'), lines: [
      t('insights.budget.help.reserve'),
      ...(r ? [t('insights.budget.help.reserveFormula', { money: fmt.money(r.money), usual: fmt.money(r.usualEssential), months: monthsText(r.months) })] : [t('insights.budget.reserveNone')]),
      t('insights.budget.reserveGuide'),
    ] },
  });
  return {
    parts,
    marks: [50, 80],
    note: m ? null : incomplete ? t('insights.budget.running') : t('insights.budget.noIncome'),
    rows,
    basis: { title: t('insights.budget.basisTitle'), lines: [
      t('insights.budget.basis.essential', { names: names(b.kinds.essential) }),
      t('insights.budget.basis.wants', { names: names(b.kinds.wants) }),
      t('insights.budget.basis.savings', { names: names(b.kinds.savings) }),
      t('insights.budget.basis.fixed', { names: names(b.kinds.fixed) }),
      t('insights.budget.basis.rates'),
    ] },
  };
}

/** The whole screen from one answer; `year` — this year, for the one-offs' dates. */
export function insightsPageView(v: InsightsOverview, fmt: MoneyFormat, scope: Scope, year: number): InsightsPageView {
  const glance = [spentGlance(v, fmt), incomeGlance(v, fmt), keptGlance(v), signalsGlance(v)];
  const budget = budgetView(v.budget, v.period.incomplete, fmt);
  if (!v.usual) {
    return { budget, glance, early: t('insights.early.text', { months: t('insights.early.months', v.months) }), cards: [], calm: false, newPayees: [], oneOffs: [], basis: [] };
  }
  return {
    budget,
    glance,
    early: null,
    cards: v.cards.map((c) => cardView(c, fmt, scope)),
    calm: v.cards.length === 0,
    newPayees: v.newPayees.map((p) => payeeRow(p, fmt, scope)),
    oneOffs: v.oneOffs.map((o) => oneOffRow(o, fmt, scope, year)),
    basis: basisLines(v),
  };
}
