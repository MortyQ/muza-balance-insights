// «What's unusual»: detectors over the shown month's sums against the usual month (medians of whole months before).
// Pure: the caller folds the sums (person, scope, banks, today's rates) and words the result.

/** An insight needs a difference of at least this share of the usual and this many kopecks. */
export const INSIGHT_SHARE = 0.2;
export const INSIGHT_MIN = 50_000;
/** Below this usual a category is «rare»: only growth counts, and no share is given. */
export const INSIGHT_BASE = 100_000;
/** Whole months the usual must be over. */
export const INSIGHT_MIN_MONTHS = 3;

export type InsightInput = {
  /** Whole months behind the usual. */
  months: number;
  /** The shown month is not over yet. */
  running: boolean;
  /** Category (stored word) → net spent in the shown month, kopecks. */
  now: ReadonlyMap<string, number>;
  /** Category → the usual month's median net, kopecks; > 0 only. */
  usual: ReadonlyMap<string, number>;
  /** The shown month's income and the median before; null while the month runs. */
  income: { now: number; usual: number } | null;
};

export type InsightType = 'category-more' | 'category-less' | 'category-rare' | 'category-over-month' | 'income-more' | 'income-less';

export type Insight = {
  type: InsightType;
  direction: 'up' | 'down';
  /** |now − usual|, kopecks. */
  amount: number;
  /** round(amount / usual × 100); null for category-rare. */
  percent: number | null;
  /** The stored category word; null for income. */
  category: string | null;
  now: number;
  usual: number;
};

export type Insights = { months: number; running: boolean; insights: Insight[] };

const percentOf = (amount: number, usual: number) => Math.round((amount / usual) * 100);

function categoryInsight(category: string, now: number, usual: number, running: boolean): Insight | null {
  const diff = now - usual;
  const amount = Math.abs(diff);
  if (amount < INSIGHT_MIN) return null;
  if (usual < INSIGHT_BASE) {
    return diff > 0 ? { type: 'category-rare', direction: 'up', amount, percent: null, category, now, usual } : null;
  }
  if (amount < usual * INSIGHT_SHARE) return null;
  if (running) {
    return diff > 0 ? { type: 'category-over-month', direction: 'up', amount, percent: percentOf(amount, usual), category, now, usual } : null;
  }
  const up = diff > 0;
  return { type: up ? 'category-more' : 'category-less', direction: up ? 'up' : 'down', amount, percent: percentOf(amount, usual), category, now, usual };
}

function incomeInsight(income: { now: number; usual: number }): Insight | null {
  const { now, usual } = income;
  const amount = Math.abs(now - usual);
  if (usual <= 0 || amount < INSIGHT_MIN || amount < usual * INSIGHT_SHARE) return null;
  const up = now > usual;
  return { type: up ? 'income-more' : 'income-less', direction: up ? 'up' : 'down', amount, percent: percentOf(amount, usual), category: null, now, usual };
}

/**
 * Every insight of the shown month, the largest difference in money first (ties by category word, income as an
 * empty word). A running month: only categories already past a whole usual month, no income. null with fewer than
 * INSIGHT_MIN_MONTHS months.
 */
export function detectInsights(input: InsightInput): Insights | null {
  if (input.months < INSIGHT_MIN_MONTHS) return null;
  const categories = new Set([...input.usual.keys(), ...input.now.keys()]);
  const found: Insight[] = [];
  for (const c of categories) {
    const i = categoryInsight(c, input.now.get(c) ?? 0, input.usual.get(c) ?? 0, input.running);
    if (i) found.push(i);
  }
  const income = !input.running && input.income ? incomeInsight(input.income) : null;
  if (income) found.push(income);
  found.sort((a, b) => b.amount - a.amount || (a.category ?? '').localeCompare(b.category ?? ''));
  return { months: input.months, running: input.running, insights: found };
}

// Explaining the lines: the payee behind a category's change, and how much of a finished month's income was kept.

/** A payee is a category's main driver from this share of the category's difference. */
export const DRIVER_SHARE = 0.3;

/** One payee of a category: net spent in the shown month and in each usual month (0 where it had none), kopecks. */
export type PayeeMonths = { name: string; now: number; months: ReadonlyArray<number> };

/** The payee behind most of a category's change: its own difference (|now − its usual|) and share of the change, 0–100. */
export type Driver = { name: string; amount: number; share: number };

/** The median, rounded to a whole kopeck; 0 for none. */
export const median = (xs: ReadonlyArray<number>): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
};

/**
 * The payee whose own difference against its median goes furthest in the direction of the category's `change`
 * (now − usual, signed); null when none reaches DRIVER_SHARE of it. Ties by name.
 */
export function mainDriver(change: number, payees: ReadonlyArray<PayeeMonths>): Driver | null {
  if (change === 0) return null;
  const sign = Math.sign(change);
  let best: { name: string; diff: number } | null = null;
  for (const p of payees) {
    const diff = (p.now - median(p.months)) * sign;
    if (diff <= 0) continue;
    if (!best || diff > best.diff || (diff === best.diff && p.name.localeCompare(best.name) < 0)) best = { name: p.name, diff };
  }
  if (!best || best.diff < Math.abs(change) * DRIVER_SHARE) return null;
  return { name: best.name, amount: best.diff, share: Math.min(100, Math.round((best.diff / Math.abs(change)) * 100)) };
}

/** A month's income and net spending, kopecks. */
export type MonthMoney = { income: number; spent: number };

/** The share of income kept, as whole percents (negative: spent more than earned), and the usual one. */
export type SavingsRate = { rate: number; usual: number };

const rateOf = (m: MonthMoney) => Math.round(((m.income - m.spent) / m.income) * 100);

/**
 * A finished month's savings rate beside the median of the usual months' rates (months with income only); null
 * without income in the month or with fewer than INSIGHT_MIN_MONTHS such months.
 */
export function savingsRate(now: MonthMoney, months: ReadonlyArray<MonthMoney>): SavingsRate | null {
  if (now.income <= 0) return null;
  const rates = months.filter((m) => m.income > 0).map(rateOf);
  if (rates.length < INSIGHT_MIN_MONTHS) return null;
  return { rate: rateOf(now), usual: median(rates) };
}

// The Insights screen: how much a change weighs, and signals at the payee level (a new payee, a large one-off).

/** A change's share of a usual month's total spending from which it is high, and medium. */
export const SEVERITY_HIGH = 0.1;
export const SEVERITY_MEDIUM = 0.04;
/** A one-off is at least this share of a usual month's total spending. */
export const ONE_OFF_SHARE = 0.1;
/** At most this many new payees and one-offs. */
export const SIGNALS_MAX = 10;

export type Severity = 'high' | 'medium' | 'low';

/** How much a difference weighs against a usual month's total spending; low without a usual total. */
export function insightSeverity(amount: number, usualTotal: number): Severity {
  if (usualTotal <= 0) return 'low';
  const share = amount / usualTotal;
  return share >= SEVERITY_HIGH ? 'high' : share >= SEVERITY_MEDIUM ? 'medium' : 'low';
}

/** Payees with at least INSIGHT_MIN spent in the shown month and nothing in any usual month; largest first, ties by name. */
export function newPayees(payees: ReadonlyArray<PayeeMonths>): PayeeMonths[] {
  return payees
    .filter((p) => p.now >= INSIGHT_MIN && p.months.every((m) => m <= 0))
    .sort((a, b) => b.now - a.now || a.name.localeCompare(b.name))
    .slice(0, SIGNALS_MAX);
}

/** One spending operation of the shown month: `amount` > 0 spent, kopecks; `payeeUsual` — its payee's usual month (median). */
export type OneOffInput = { key: string; amount: number; payeeUsual: number };

/**
 * Operations of at least INSIGHT_MIN and ONE_OFF_SHARE of a usual month whose payee usually spends less than half of
 * them a month; largest first, ties by key.
 */
export function oneOffs<T extends OneOffInput>(ops: ReadonlyArray<T>, usualTotal: number): T[] {
  const min = Math.max(INSIGHT_MIN, usualTotal * ONE_OFF_SHARE);
  return ops
    .filter((o) => o.amount >= min && o.payeeUsual < o.amount / 2)
    .sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key))
    .slice(0, SIGNALS_MAX);
}

/** The median of a payee's usual months (0 where none), the `payeeUsual` of its operations. */
export const payeeUsual = (p: PayeeMonths): number => median(p.months);
