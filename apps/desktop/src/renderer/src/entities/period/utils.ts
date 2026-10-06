import { monthName, monthShortName, shiftMonth, t, type YearMonth } from '@/shared/lib';
import type { MonthRangePreset } from '@/shared/ui';

const short = (ym: string) => `${monthShortName(Number(ym.slice(5, 7)))} ${ym.slice(0, 4)}`;
const full = (ym: string) => `${monthName(Number(ym.slice(5, 7)))} ${ym.slice(0, 4)}`;
const span = (from: string, to: string) => (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;

/** The picker's quick picks: ranges are whole months ending last month, from the import floor at the earliest. */
export function rangePresets(thisMonth: YearMonth, floor: YearMonth): { month: MonthRangePreset[]; range: MonthRangePreset[] } {
  const last = shiftMonth(thisMonth, -1);
  const atLeast = (m: YearMonth): YearMonth => (m < floor ? floor : m);
  const year = Number(thisMonth.slice(0, 4));
  const january = `${year}-01` as YearMonth;
  const yearAgo = shiftMonth(thisMonth, -12);
  return {
    month: [
      { id: 'this', label: t('entities.period.thisMonth'), from: thisMonth, to: thisMonth },
      { id: 'last', label: t('entities.period.lastMonth'), from: last, to: last },
      ...(yearAgo >= floor ? [{ id: 'yago', label: t('entities.period.yearAgo'), from: yearAgo, to: yearAgo }] : []),
    ],
    range: [
      ...[3, 6, 12, 24, 36].map((n) => ({ id: String(n), label: t('entities.period.months', n), from: atLeast(shiftMonth(last, -(n - 1))), to: last })),
      // In January «since January» would be this running month alone: it is the «This month» pick then.
      ...(thisMonth > january ? [{ id: 'ytd', label: t('entities.period.sinceJanuary'), from: atLeast(january), to: last }] : []),
      { id: 'ly', label: t('entities.period.lastYear', { year: year - 1 }), from: atLeast(`${year - 1}-01`), to: `${year - 1}-12` as YearMonth },
      { id: 'all', label: t('entities.period.all'), from: floor, to: last },
    ],
  };
}

/** The picker's note: what the pick is compared with (main's rule, src/main/analytics.ts), and whether it reaches this running month. */
export function compareText(r: { from: string; to: string }, thisMonth: string, dataFrom: string | null): { compare: string; running: string | null } {
  const n = span(r.from, r.to);
  const pFrom = shiftMonth(r.from as YearMonth, -n);
  const pTo = shiftMonth(r.from as YearMonth, -1);
  const period = n === 1 ? full(pFrom).toLowerCase() : `${short(pFrom)} – ${short(pTo)}`;
  const compare = dataFrom === null || dataFrom > `${pFrom}-01` ? t('entities.period.noCompare') : t('entities.period.compare', { period });
  return { compare, running: r.to === thisMonth ? t('entities.period.running', { month: monthName(Number(thisMonth.slice(5, 7))) }) : null };
}
