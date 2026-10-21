// Budgets of bench/run.ts, ms, for the default dataset (bench/generate.ts DEFAULT_BENCH) in an encrypted file.
// Set after openspec/changes/archive/2026-10-21-core-read-model (its baseline.md has before and after): about five
// times the measured time, for slower machines and noise, and never above the targets of its design D8. The full
// re-derivation keeps about twice its time: it is the slowest case and the most stable one.
export type BenchCase =
  | 'month by category'
  | 'month income by source'
  | '12 months by month'
  | '12 months by day'
  | 'spending block set'
  | 'balances at two instants'
  | 'full re-derivation'
  | 'end of a routine auto-sync';

export const BUDGETS_MS: Readonly<Record<BenchCase, number>> = {
  'month by category': 10,
  'month income by source': 10,
  '12 months by month': 100,
  '12 months by day': 150,
  'spending block set': 120,
  'balances at two instants': 5,
  'full re-derivation': 3000,
  'end of a routine auto-sync': 250,
};
