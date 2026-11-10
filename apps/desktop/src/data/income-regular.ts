// The income screen's regular income (DataService.incomeOverview): the active regular income sources of core
// findRecurring (`kind: 'income'`), what they bring a month, when each is next expected and how much of it the regular
// payments take. Pure: the data service gathers the inputs.
import type { RegularIncome, RegularIncomeSource } from '../shared/api.ts';

/** «Expected» looks this many days ahead of today. */
export const EXPECTED_DAYS = 30;

/** The last payment differs from the usual one by more than this share: «amount changed». */
const CHANGE_SHARE = 0.1;

/** One active series, as the data service prepared it. */
export type RegularSeries = {
  key: string;
  name: string;
  participantId: number;
  uah: number | null;
  currency: number;
  amount: number;
  /** The usual and the last payment in the operation currency (what the series is matched by). */
  usualOperation: number;
  lastOperation: number;
  /** YYYY-MM-DD: the last payment and the next one expected (nextMonthDay of the last). */
  last: string;
  next: string;
};

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** The last payment against the usual one, whole signed per cent; null within ±10% or without a usual amount. */
export function amountChange(usual: number, last: number): number | null {
  if (usual <= 0) return null;
  const share = (last - usual) / usual;
  return Math.abs(share) > CHANGE_SHARE ? Math.round(share * 100) : null;
}

/** The regular income of `series` (active ones) as of `today`; `paymentsMonthly` — the active regular payments' monthly sum. */
export function regularIncome(series: ReadonlyArray<RegularSeries>, today: string, paymentsMonthly: number): RegularIncome {
  const sources: RegularIncomeSource[] = series
    .map((s) => {
      const next = s.next;
      const late = next < today ? daysBetween(next, today) : null;
      return {
        key: s.key,
        name: s.name,
        participantId: s.participantId,
        uah: s.uah,
        currency: s.currency,
        amount: s.amount,
        last: s.last,
        next,
        late,
        change: amountChange(s.usualOperation, s.lastOperation),
      };
    })
    .sort((a, b) => (b.uah ?? -1) - (a.uah ?? -1) || a.key.localeCompare(b.key));
  const monthly = sources.reduce((sum, s) => sum + (s.uah ?? 0), 0);
  const expected = sources
    .filter((s) => s.next >= today && daysBetween(today, s.next) <= EXPECTED_DAYS)
    .sort((a, b) => a.next.localeCompare(b.next) || (b.uah ?? -1) - (a.uah ?? -1));
  return {
    today,
    monthly,
    coveredByPayments: monthly > 0 ? Math.round((paymentsMonthly / monthly) * 100) : null,
    sources,
    expected,
  };
}
