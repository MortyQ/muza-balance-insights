// Savings goals (E2): how far a goal is — the money its source holds now against the target — and, with a date, how
// much is still needed a month. Pure: the data process reads the jar's or the owner's money and hands it here.

/** A goal's progress; all null but `overdue` when its source is gone (a closed jar). */
export type SavingProgress = {
  progress: number | null;
  /** Whole per cent of the target, at most 100. */
  percent: number | null;
  /** What is still needed, never below 0. */
  left: number | null;
  /** With a date and something left: left ÷ the months to it, rounded up to a whole hryvnia (100 kopecks). */
  perMonth: number | null;
  /** The months to the date, the current one counted and the date's own not: November → June is 7. */
  months: number | null;
  /** The date has passed with something left. */
  overdue: boolean;
};

const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;

/** `today` and `until` are YYYY-MM-DD; `money` null — the source is gone. */
export function savingProgress(target: number, money: number | null, until: string | null, today: string): SavingProgress {
  if (money === null) return { progress: null, percent: null, left: null, perMonth: null, months: null, overdue: false };
  const left = Math.max(0, target - money);
  const percent = target > 0 ? Math.min(100, Math.floor((money / target) * 100)) : 100;
  if (until === null || left === 0) return { progress: money, percent, left, perMonth: null, months: null, overdue: false };
  if (until < today) return { progress: money, percent, left, perMonth: null, months: null, overdue: true };
  const months = Math.max(1, monthIndex(until) - monthIndex(today));
  return { progress: money, percent, left, perMonth: Math.ceil(left / months / 100) * 100, months, overdue: false };
}
