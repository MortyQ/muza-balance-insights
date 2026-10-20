// Budgets of bench/run.ts, ms, for the default dataset (bench/generate.ts DEFAULT_BENCH) in an encrypted file.
// The read cases are at the targets of openspec/changes/core-read-model/design.md D8 (several times the measured time,
// for slower machines); the re-derivation is still the baseline + 20% until incremental re-derivation lands.
export type BenchCase =
  | 'month by category'
  | 'month income by source'
  | '12 months by month'
  | '12 months by day'
  | 'spending block set'
  | 'balances at two instants'
  | 'full re-derivation';

export const BUDGETS_MS: Readonly<Record<BenchCase, number>> = {
  'month by category': 20,
  'month income by source': 20,
  '12 months by month': 100,
  '12 months by day': 150,
  'spending block set': 300,
  'balances at two instants': 5,
  'full re-derivation': 3700,
};
