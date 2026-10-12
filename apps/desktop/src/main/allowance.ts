// «Available per day» in main: the money on cards now, minus the reserve and the mandatory payments due before the next
// regular income, spread over the days until it. Pure: DataService.allowanceOverview gathers the inputs.
import type { AllowanceIncome, AllowancePayment } from '../shared/api.ts';

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to` (YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The first day of the month after `date`'s. */
export function nextMonthStart(date: string): string {
  const [y, m] = date.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

/** A regular income or payment as the calculation needs it: hryvnia by today's rate (null — no rate), the next date. */
export type AllowanceSeries = { key: string; name: string; participantId: number; uah: number | null; next: string };

export type Allowance = {
  /** The day the money has to last until (exclusive): the next income, or the next month's first day without one. */
  until: string;
  days: number;
  income: AllowanceIncome | null;
  mandatory: AllowancePayment[];
  /** money − reserve − the mandatory payments; < 0 — short of that much. */
  free: number;
  /** free / days, whole kopecks down; 0 when short. */
  perDay: number;
};

/**
 * The next income is the largest regular one of each person (a series without a rate is not a candidate); of those, the
 * earliest that is still to come (after today). One that was due today or earlier and has not come is `overdue`: the
 * money then has to last to the month's end. Mandatory payments count when due before `until`, overdue ones too.
 */
export function allowance(input: {
  today: string;
  money: number;
  reserve: number;
  income: ReadonlyArray<AllowanceSeries>;
  mandatory: ReadonlyArray<AllowanceSeries>;
}): Allowance {
  const largest = new Map<number, AllowanceSeries>();
  for (const s of input.income) {
    if (s.uah === null) continue;
    const held = largest.get(s.participantId);
    if (!held || s.uah > (held.uah ?? 0)) largest.set(s.participantId, s);
  }
  const mains = [...largest.values()].sort((a, b) => a.next.localeCompare(b.next) || a.key.localeCompare(b.key));
  const coming = mains.find((s) => s.next > input.today);
  const late = mains.filter((s) => s.next <= input.today).at(-1);
  const pick = coming ?? late ?? null;
  const until = coming ? coming.next : nextMonthStart(input.today);
  const income: AllowanceIncome | null = pick ? { key: pick.key, name: pick.name, uah: pick.uah ?? 0, date: pick.next, overdue: !coming } : null;

  const mandatory = input.mandatory
    .filter((p) => p.next < until)
    .sort((a, b) => a.next.localeCompare(b.next) || a.key.localeCompare(b.key))
    .map((p) => ({ key: p.key, name: p.name, uah: p.uah, due: p.next }));
  const due = mandatory.reduce((s, p) => s + (p.uah ?? 0), 0);
  const days = daysBetween(input.today, until);
  const free = input.money - input.reserve - due;
  return { until, days, income, mandatory, free, perDay: free > 0 ? Math.floor(free / days) : 0 };
}
