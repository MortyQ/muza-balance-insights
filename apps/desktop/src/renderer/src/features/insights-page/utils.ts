import type { InsightCardView as InsightCard, InsightsOverview, NewPayeeView, OneOffView, Scope } from '@contract/api.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { categoryLink, incomeLink } from '@/shared/config';
import { change, changeText, dayMonthName, monthName, monthShortName, t } from '@/shared/lib';
import type { GlanceView, InsightBarsView, InsightCardView, InsightsPageView, SignalRowView } from './types.ts';

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

/** The whole screen from one answer; `year` — this year, for the one-offs' dates. */
export function insightsPageView(v: InsightsOverview, fmt: MoneyFormat, scope: Scope, year: number): InsightsPageView {
  const glance = [spentGlance(v, fmt), incomeGlance(v, fmt), keptGlance(v), signalsGlance(v)];
  if (!v.usual) {
    return { glance, early: t('insights.early.text', { months: t('insights.early.months', v.months) }), cards: [], calm: false, newPayees: [], oneOffs: [], basis: [] };
  }
  return {
    glance,
    early: null,
    cards: v.cards.map((c) => cardView(c, fmt, scope)),
    calm: v.cards.length === 0,
    newPayees: v.newPayees.map((p) => payeeRow(p, fmt, scope)),
    oneOffs: v.oneOffs.map((o) => oneOffRow(o, fmt, scope, year)),
    basis: basisLines(v),
  };
}
