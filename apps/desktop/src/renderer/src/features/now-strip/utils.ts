import type { NowOverview } from '@contract/api.ts';
import { categoryColor, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { change, monthShortName, shortDate, t } from '@/shared/lib';
import type { ChangeChipModel } from '@/shared/ui';
import { MIN_BAR } from './constants.ts';
import type { NowStripView, TopCell, WeekBar } from './types.ts';

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

/** Against a usual day or last week's same days: «+38%» with the arrow, or «as usual»; null — no base or a base ≤ 0. */
export function nowChip(now: number, base: number | null, against: 'usual' | 'week'): ChangeChipModel | null {
  if (base === null || base <= 0) return null;
  const c = change(now, base);
  if (!c || c.kind === 'new') return null;
  if (c.kind === 'same') return { text: t(SAME[against]), tone: 'neutral', arrow: null, sr: '' };
  const dir = c.kind === 'up' ? 'up' : 'down';
  return { text: `${dir === 'up' ? '+' : '−'}${c.pct}%`, tone: dir, arrow: dir, sr: t(SR[against][dir]) };
}

function topCell(top: NowOverview['week']['top'], weekNet: number, fmt: MoneyFormat): TopCell | null {
  if (!top) return null;
  // Refunds in another category can pull the week's net below the top category's own: the share stops at 100%.
  const pct = weekNet > 0 ? Math.min(100, Math.round((top.net / weekNet) * 100)) : 0;
  return {
    name: categoryName(top),
    color: categoryColor(top.rank),
    amount: fmt.money(top.net),
    caption: t('home.now.topShare', { pct, ops: t('home.now.opsShort', { n: top.purchases }) }),
  };
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
      chip: stale ? null : nowChip(o.today.net, usual, 'usual'),
      context: !stale && usual !== null ? t('home.now.vsUsual', { amount: fmt.money(usual) }) : '',
      until: stale && o.dataUntil !== null ? t('home.now.until', { date: shortDate(o.dataUntil) }) : '',
    },
    week: {
      title: t('home.now.week', { days }),
      amount: fmt.money(o.week.total.net),
      conv: fmt.approxInline(o.week.total.net),
      chip: nowChip(o.week.total.net, prev, 'week'),
      context: prev !== null ? t('home.now.vsWeek', { days }) : '',
      bars: weekBars(o.week.days, o.weekday),
      pending: o.week.pendingHolds,
    },
    top: topCell(o.week.top, o.week.total.net, fmt),
  };
}
