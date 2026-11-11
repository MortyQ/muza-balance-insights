import type { BudgetStructureView, LimitAheadView, LimitOverView, InsightCardView as InsightCard, InsightSeverity, InsightsOverview, NewPayeeView, OneOffView, Scope } from '@contract/api.ts';
import type { CategoryId } from '@contract/categories.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { budgetLink, categoryLink, incomeLink } from '@/shared/config';
import { change, changeText, dayMonthName, formatMoney, i18n, monthName, monthShortName, t } from '@/shared/lib';
import { monthsText, percent } from './format.ts';
import { healthView } from './health.ts';
import type { BudgetCardView, BudgetPartView, BudgetRowView, FeedItemView, FeedKind, GlanceView, InsightBarsView, InsightCardView, InsightsPageView, SignalCardView, SignalRowView } from '../types.ts';

const monthNo = (ym: string) => Number(ym.slice(5, 7));

/** «2025-09» → «Sep 2025». */
const monthText = (ym: string) => `${monthShortName(monthNo(ym))} ${ym.slice(0, 4)}`;


/** A change in each picked «Show also» currency: «≈ +300 $». */
const signedAlso = (fmt: MoneyFormat, sign: '+' | '−', kopecks: number): string[] =>
  fmt.alsoParts(kopecks).map((p) => `≈ ${sign}${formatMoney(p.minor, p.currency)}`);

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function spentGlance(v: InsightsOverview, fmt: MoneyFormat): GlanceView {
  const base = { key: 'spent', label: t('insights.glance.spent'), value: fmt.money(v.spent), also: fmt.approx(v.spent) } as const;
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
  if (!income) return { key: 'income', label, value: '—', also: [], note: t(v.period.incomplete ? 'insights.glance.monthEnd' : 'insights.glance.noUsual'), tone: 'neutral', meter: null };
  const c = change(income.now, income.usual);
  const note =
    !c || c.kind === 'same' || c.kind === 'new'
      ? t('insights.glance.asUsual', { usual: fmt.money(income.usual) })
      : t(c.kind === 'up' ? 'insights.glance.above' : 'insights.glance.below', { diff: changeText(c, fmt.money), usual: fmt.money(income.usual) });
  return { key: 'income', label, value: fmt.money(income.now), also: fmt.approx(income.now), note, tone: 'neutral', meter: null };
}

function keptGlance(v: InsightsOverview): GlanceView {
  const label = t('insights.glance.kept');
  const s = v.usual?.savings;
  if (!s) {
    const why = v.period.incomplete ? 'insights.glance.monthEnd' : 'insights.glance.noSavings';
    return { key: 'kept', label, value: '—', also: [], note: t(why), tone: 'neutral', meter: null };
  }
  return { key: 'kept', label, value: percent(s.rate), also: [], note: t('insights.glance.usually', { usual: percent(s.usual) }), tone: s.rate >= s.usual ? 'good' : 'bad', meter: null };
}

/** Every feed item's severity: the cards, the limits (over and ahead), new payees and one-offs. */
export function feedSeverities(v: InsightsOverview): InsightSeverity[] {
  return [...v.cards, ...v.limitsOver, ...v.limitsAhead, ...v.newPayees, ...v.oneOffs].map((x) => x.severity);
}

const SEVERITIES: ReadonlyArray<InsightSeverity> = ['high', 'medium', 'low'];
const COUNT_KEY = { high: 'insights.severity.countHigh', medium: 'insights.severity.countMedium', low: 'insights.severity.countLow' } as const;

/** The signals figure: every feed item, split by severity on one bar (spec desktop-insights-page «The month at a glance»). */
function signalsGlance(v: InsightsOverview): GlanceView {
  const all = feedSeverities(v);
  const parts = SEVERITIES.map((severity) => ({ severity, count: all.filter((s) => s === severity).length }))
    .filter((p) => p.count > 0)
    .map((p) => ({ ...p, text: t(COUNT_KEY[p.severity], p.count) }));
  return {
    key: 'signals',
    label: t('insights.glance.signals'),
    value: v.usual ? String(all.length) : '—',
    also: [],
    note: v.usual && parts.length === 0 ? t('insights.glance.noSignals') : '',
    tone: parts[0]?.severity === 'high' ? 'up' : 'neutral',
    meter: null,
    split: v.usual && parts.length > 0 ? parts : null,
  };
}

/**
 * The running month's forecast (spec desktop-insights-page «Month-end forecast»): the figure, its range and a «?» with
 * the formula in the user's numbers; null for a finished month or without a usual.
 */
export function forecastGlance(v: InsightsOverview, fmt: MoneyFormat): GlanceView | null {
  const f = v.forecast;
  if (!f) return null;
  const label = t('insights.glance.forecast');
  return {
    key: 'forecast',
    label,
    value: fmt.money(f.value),
    also: fmt.approx(f.value),
    note: '',
    tone: 'neutral',
    meter: null,
    range: f.low === f.high ? null : t('insights.glance.forecastRange', { low: fmt.money(f.low), high: fmt.money(f.high) }),
    help: {
      label: t('insights.budget.helpLabel', { name: label }),
      title: label,
      lines: [
        t('insights.glance.forecastHelp.what'),
        t('insights.glance.forecastHelp.formula', {
          spent: fmt.money(f.spent),
          regular: fmt.money(f.regular),
          perDay: fmt.money(f.perDay),
          days: t('insights.glance.forecastHelp.days', f.daysLeft),
          value: fmt.money(f.value),
        }),
        t('insights.glance.forecastHelp.regular', { n: f.regularCount }),
        t('insights.glance.forecastHelp.typical'),
        t('insights.glance.forecastHelp.range', { low: fmt.money(f.perDayLow), high: fmt.money(f.perDayHigh) }),
      ],
    },
  };
}

/** A tooltip's amount followed by its «Show also» currencies: «69 € · ≈ 3 541 ₴». */
function withAlso(fmt: MoneyFormat, kopecks: number): string {
  const also = fmt.approxInline(kopecks);
  return also ? `${fmt.money(kopecks)} · ${also}` : fmt.money(kopecks);
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
      title: `${monthName(monthNo(s.month))} ${s.month.slice(0, 4)} — ${withAlso(fmt, Math.max(0, s.value))}`,
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
    also: signedAlso(fmt, sign, c.amount),
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
    caption: `${t('insights.filter.signal.payee')} · ${categoryName(p)}`,
    amount: fmt.money(p.amount),
    also: fmt.approx(p.amount),
    to: p.categoryId ? categoryLink(p.categoryId, scope) : null,
  };
}

function oneOffRow(o: OneOffView, fmt: MoneyFormat, scope: Scope, year: number): SignalRowView {
  const category = categoryName(o);
  return {
    key: o.key,
    icon: CATEGORY_ICON[o.categoryId ?? 'rest'],
    name: o.name || category,
    caption: `${t('insights.filter.signal.oneOff')} · ${dayMonthName(o.date, year)} · ${category}`,
    amount: fmt.money(o.amount),
    also: fmt.approx(o.amount),
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
    `${t('insights.newPayees.title')}: ${t('insights.newPayees.hint').toLowerCase()}.`,
    `${t('insights.oneOffs.title')}: ${t('insights.oneOffs.hint').toLowerCase()}.`,
    ...(v.period.incomplete ? [t('insights.basis.running')] : []),
    ...(v.health?.forecast ? [t('insights.health.forecastBasis')] : []),
    ...(v.period.pendingHolds > 0 ? [t('insights.basis.pending', v.period.pendingHolds)] : []),
    ...(v.cashCounts ? [] : [t('insights.basis.cashOff')]),
  ];
}

const names = (ids: ReadonlyArray<CategoryId>) => ids.map((id) => categoryName({ category: id, categoryId: id })).join(', ');

/** «2,4 months», one decimal, in the app language's way. */

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

const limitName = (l: { categoryId: LimitOverView['categoryId'] }) =>
  l.categoryId ? categoryName({ category: l.categoryId, categoryId: l.categoryId }) : t('insights.limit.budget');

/** A monthly limit over in the month, as a feed card: how much over, spent against the limit, a link to the «Budget» screen. */
export function limitCard(l: LimitOverView, fmt: MoneyFormat): InsightCardView {
  return {
    key: `limit-${l.categoryId ?? 'budget'}`,
    icon: l.categoryId ? CATEGORY_ICON[l.categoryId] : 'lucide:wallet',
    title: t('insights.limit.title', { name: limitName(l) }),
    severity: l.severity,
    severityLabel: t(`insights.severity.${l.severity}`),
    text: t('insights.limit.text', { spent: fmt.money(l.spent), amount: fmt.money(l.amount) }),
    chip: { text: `+${fmt.money(l.over)}`, tone: 'up', arrow: 'up', sr: '' },
    also: signedAlso(fmt, '+', l.over),
    tone: 'up',
    bars: null,
    driver: null,
    to: budgetLink(),
    linkText: t('insights.limit.open'),
  };
}

/** A monthly limit the forecast puts over, as a feed card: the forecast, the overrun, per day to stay within. */
export function limitAheadCard(l: LimitAheadView, fmt: MoneyFormat): InsightCardView {
  return {
    key: `limit-ahead-${l.categoryId ?? 'budget'}`,
    icon: l.categoryId ? CATEGORY_ICON[l.categoryId] : 'lucide:wallet',
    title: t('insights.limitAhead.title', { name: limitName(l) }),
    severity: l.severity,
    severityLabel: t(`insights.severity.${l.severity}`),
    text: t('insights.limitAhead.text', { forecast: fmt.money(l.forecast), amount: fmt.money(l.amount), perDay: fmt.money(l.perDay) }),
    chip: { text: `+${fmt.money(l.over)}`, tone: 'up', arrow: 'up', sr: t('insights.limitAhead.chip') },
    also: signedAlso(fmt, '+', l.over),
    tone: 'up',
    bars: null,
    driver: null,
    to: budgetLink(),
    linkText: t('insights.limit.open'),
  };
}

const KIND_OF: Readonly<Record<InsightCard['type'], FeedKind>> = {
  'category-more': 'up',
  'category-rare': 'up',
  'category-over-month': 'up',
  'category-less': 'down',
  'income-more': 'income',
  'income-less': 'income',
};

/**
 * The feed (spec desktop-insights-page «The full feed»): the insights, the limits (over and ahead), new payees and
 * one-offs, ranked by money — the change, the overrun or the amount; equal money keeps that order.
 */
export function feedItems(v: InsightsOverview, fmt: MoneyFormat, scope: Scope, year: number): FeedItemView[] {
  const signal = (row: SignalRowView, severity: InsightSeverity): SignalCardView => ({ ...row, severity, severityLabel: t(`insights.severity.${severity}`) });
  const items: FeedItemView[] = [
    ...v.cards.map((c): FeedItemView => ({ key: `card-${c.type}-${c.categoryId ?? 'income'}`, kind: KIND_OF[c.type], severity: c.severity, money: c.amount, card: cardView(c, fmt, scope), signal: null })),
    ...v.limitsOver.map((l): FeedItemView => ({ key: `limit-${l.categoryId ?? 'budget'}`, kind: 'limits', severity: l.severity, money: l.over, card: limitCard(l, fmt), signal: null })),
    ...v.limitsAhead.map((l): FeedItemView => ({ key: `ahead-${l.categoryId ?? 'budget'}`, kind: 'limits', severity: l.severity, money: l.over, card: limitAheadCard(l, fmt), signal: null })),
    ...v.newPayees.map((p): FeedItemView => ({ key: `payee-${p.name}`, kind: 'payees', severity: p.severity, money: p.amount, card: null, signal: signal(payeeRow(p, fmt, scope), p.severity) })),
    ...v.oneOffs.map((o): FeedItemView => ({ key: `oneoff-${o.key}`, kind: 'oneOffs', severity: o.severity, money: o.amount, card: null, signal: signal(oneOffRow(o, fmt, scope, year), o.severity) })),
  ];
  return items.sort((a, b) => b.money - a.money);
}

/** The whole screen from one answer; `year` — this year, for the one-offs' dates. */
export function insightsPageView(v: InsightsOverview, fmt: MoneyFormat, scope: Scope, year: number): InsightsPageView {
  const forecast = forecastGlance(v, fmt);
  const glance = [spentGlance(v, fmt), ...(forecast ? [forecast] : []), incomeGlance(v, fmt), keptGlance(v), signalsGlance(v)];
  const health = healthView(v, budgetView(v.budget, v.period.incomplete, fmt), fmt);
  const feed = v.usual ? feedItems(v, fmt, scope, year) : [];
  if (!v.usual) {
    return { health, glance, early: t('insights.early.text', { months: t('insights.early.months', v.months) }), feed: [], calm: false, basis: [] };
  }
  return {
    health,
    glance,
    early: null,
    feed,
    calm: feed.length === 0,
    basis: basisLines(v),
  };
}
