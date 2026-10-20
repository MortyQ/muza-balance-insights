// Budgets of bench/run.ts, ms, for the default dataset (bench/generate.ts DEFAULT_BENCH) in an encrypted file.
// Temporary: the baseline + 20%, at least 5 ms (openspec/changes/core-read-model/baseline.md); tightened as the change
// lands.
export type BenchCase =
  | 'month by category'
  | 'month income by source'
  | '12 months by month'
  | '12 months by day'
  | 'spending block set'
  | 'balances at two instants'
  | 'full re-derivation';

export const BUDGETS_MS: Readonly<Record<BenchCase, number>> = {
  'month by category': 220,
  'month income by source': 215,
  '12 months by month': 755,
  '12 months by day': 870,
  'spending block set': 11250,
  'balances at two instants': 5,
  'full re-derivation': 3700,
};
