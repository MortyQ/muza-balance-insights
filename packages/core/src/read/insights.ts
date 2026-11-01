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
