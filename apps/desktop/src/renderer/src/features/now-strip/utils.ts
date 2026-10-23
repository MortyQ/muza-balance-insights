import type { NowCategory, NowOverview, SpendingAmounts } from '@contract/api.ts';
import { CATEGORY_ICON, categoryColor, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { categoryLink, type LinkPeriod } from '@/shared/config';
import { change, changeText, monthShortName, shortDate, t } from '@/shared/lib';
import type { ChangeChipModel } from '@/shared/ui';
import { MIN_BAR, SHOWN_CATEGORIES } from './constants.ts';
import type { CategoryBreakdown, CategoryRow, NowPrefs, NowStripView, WeekBar } from './types.ts';

type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
// The contract's weekday is 1–7 by construction (main's isoWeekday).
const weekdayName = (n: number) => t(`common.weekdayShort.${n as Weekday}`);

/** «сб, 3 окт». */
export function dayLabel(date: string, weekday: number): string {
  return t('home.now.date', { weekday: weekdayName(weekday), day: Number(date.slice(8, 10)), month: monthShortName(Number(date.slice(5, 7))) });
}

/** «пн–сб»; on Monday just «пн». */
export function daysRange(weekday: number): string {
  return weekday === 1 ? weekdayName(1) : `${weekdayName(1)}–${weekdayName(weekday)}`;
}

/** Monday … Sunday: today, the days before it, the days after it; heights relative to the week's largest day. */
export function weekBars(days: ReadonlyArray<number | null>, weekday: number): WeekBar[] {
  const max = Math.max(0, ...days.map((d) => d ?? 0));
  return days.map((d, i): WeekBar => {
    const kind = i + 1 < weekday ? 'past' : i + 1 === weekday ? 'today' : 'future';
    const v = d ?? 0;
    return { kind, height: max > 0 && v > 0 ? Math.max(MIN_BAR, Math.round((v / max) * 100)) : 0 };
  });
}

const SAME = { usual: 'home.now.sameUsual', week: 'home.now.sameWeek' } as const;
const SR = {
  usual: { up: 'home.now.srMoreUsual', down: 'home.now.srLessUsual' },
  week: { up: 'home.now.srMoreWeek', down: 'home.now.srLessWeek' },
} as const;

/** Against a usual day or last week's same days: «+420 ₴ (38%)» with the arrow, or «as usual»; null — no base or a base ≤ 0. */
export function nowChip(now: number, base: number | null, against: 'usual' | 'week', fmt: MoneyFormat): ChangeChipModel | null {
  if (base === null || base <= 0) return null;
  const c = change(now, base);
  if (!c || c.kind === 'new') return null;
  if (c.kind === 'same') return { text: t(SAME[against]), tone: 'neutral', arrow: null, sr: '' };
  const dir = c.kind === 'up' ? 'up' : 'down';
  return { text: changeText(c, fmt.money, true), tone: dir, arrow: dir, sr: t(SR[against][dir]) };
}

/** A category against the same days last week: «+120 ₴» (no percent: the row has no room), «same», «new»; null — no comparison. */
export function categoryChip(net: number, prev: number | null, fmt: MoneyFormat): ChangeChipModel | null {
  if (prev === null) return null;
  const c = change(net, prev);
  if (!c) return null;
  if (c.kind === 'new' || c.kind === 'same') {
    return { text: t(c.kind === 'new' ? 'home.now.cats.new' : 'home.now.cats.same'), tone: 'neutral', arrow: null, sr: '' };
  }
  const dir = c.kind === 'up' ? 'up' : 'down';
  return { text: `${dir === 'up' ? '+' : '−'}${fmt.money(c.diff)}`, tone: dir, arrow: dir, sr: t(SR.week[dir]) };
}

/**
 * One period's list, each row a link to its category's screen for that day or week (personal, as the strip); the share
 * of a category stops at 100% (refunds elsewhere can pull the total below it).
 */
export function breakdown(
  cats: ReadonlyArray<NowCategory & { prev?: number | null }>,
  total: SpendingAmounts,
  period: LinkPeriod,
  fmt: MoneyFormat,
  note = '',
): CategoryBreakdown {
  const biggest = Math.max(0, ...cats.map((c) => c.net));
  const rows = cats.map(
    (c): CategoryRow => ({
      key: c.category,
      name: categoryName(c),
      color: categoryColor(c.rank),
      amount: fmt.money(c.net),
      ops: t('home.now.opsShort', { n: c.purchases }),
      share: total.net > 0 ? Math.min(100, Math.round((c.net / total.net) * 100)) : 0,
      bar: biggest > 0 ? Math.max(0, Math.round((c.net / biggest) * 100)) : 0,
      icon: CATEGORY_ICON[c.categoryId ?? 'other'],
      chip: categoryChip(c.net, c.prev ?? null, fmt),
      to: c.categoryId ? categoryLink(c.categoryId, 'personal', period) : null,
    }),
  );
  if (rows.length === 0) return { rows, summary: '', note: '', more: '' };
  const summary = [t('home.now.cats.count', rows.length), fmt.money(total.net), t('home.now.ops', total.purchases)].join(' · ');
  const rest = cats.slice(SHOWN_CATEGORIES);
  const more = rest.length > 0 ? t('home.now.cats.more', { n: rest.length, amount: fmt.money(rest.reduce((sum, c) => sum + c.net, 0)) }, rest.length) : '';
  return { rows, summary, note, more };
}

/** Stored choices, each field forgiven on its own: the week. */
export function parsePrefs(raw: string | null): NowPrefs {
  let v: unknown = null;
  try {
    v = raw === null ? null : JSON.parse(raw);
  } catch {
    // Damaged: the defaults.
  }
  const o = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
  return { period: o['period'] === 'today' ? 'today' : 'week' };
}

/** Everything the strip shows for one answer, every amount in the home-wide main currency. */
export function nowView(o: Readonly<NowOverview>, fmt: MoneyFormat): NowStripView {
  const stale = o.dataUntil !== null && o.dataUntil < o.date;
  const usual = o.usualDay !== null && o.usualDay > 0 ? o.usualDay : null;
  const prev = o.week.prev !== null && o.week.prev > 0 ? o.week.prev : null;
  const days = daysRange(o.weekday);
  return {
    today: {
      title: t('home.now.today', { date: dayLabel(o.date, o.weekday) }),
      amount: fmt.money(o.today.net),
      ops: t('home.now.ops', o.today.purchases),
      conv: fmt.approxInline(o.today.net),
      chip: stale ? null : nowChip(o.today.net, usual, 'usual', fmt),
      context: !stale && usual !== null ? t('home.now.vsUsual', { amount: fmt.money(usual) }) : '',
      until: stale && o.dataUntil !== null ? t('home.now.until', { date: shortDate(o.dataUntil) }) : '',
    },
    week: {
      title: t('home.now.week', { days }),
      amount: fmt.money(o.week.total.net),
      conv: fmt.approxInline(o.week.total.net),
      chip: nowChip(o.week.total.net, prev, 'week', fmt),
      context: prev !== null ? t('home.now.vsWeek', { days }) : '',
      bars: weekBars(o.week.days, o.weekday),
      pending: o.week.pendingHolds,
    },
    categories: {
      today: breakdown(o.todayCategories, o.today, { kind: 'day', date: o.date }, fmt),
      week: breakdown(o.week.categories, o.week.total, { kind: 'week', from: o.week.from }, fmt, o.week.prev !== null ? t('home.now.cats.vsWeek', { days }) : ''),
    },
  };
}
