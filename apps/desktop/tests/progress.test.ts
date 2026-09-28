// importActive: exhaustive over every phase — a new phase must be classified, not fall through silently.
import { describe, expect, it } from 'vitest';
import { importActive, type ImportProgress } from '../src/shared/progress.ts';

const CASES: Array<[ImportProgress, boolean]> = [
  [{ phase: 'idle' }, false],
  [{ phase: 'needs-token', connectionIds: [1] }, false],
  [{ phase: 'starting', resumed: false }, true],
  [{ phase: 'accounts' }, true],
  [
    {
      phase: 'windows',
      account: 'black/UAH',
      from: '2026-01-01',
      to: '2026-01-31',
      round: 1,
      index: 1,
      total: 1,
      windowsDone: 0,
      windowsTotal: 1,
      transactions: 0,
      etaSec: 60,
      waitingSec: null,
    },
    true,
  ],
  [{ phase: 'retry', reason: 'crash', attempt: 1, inSec: 60 }, true],
  [{ phase: 'rederive' }, true],
  [{ phase: 'done', windowsTotal: 1, transactions: 1, failed: [] }, false],
  [{ phase: 'cancelled' }, false],
  [{ phase: 'error', error: 'other' }, false],
];

describe('importActive', () => {
  it.each(CASES)('%o → %s', (progress, expected) => {
    expect(importActive(progress)).toBe(expected);
  });

  it('covers every phase of ImportProgress', () => {
    const phases: ReadonlyArray<ImportProgress['phase']> = [
      'idle',
      'needs-token',
      'starting',
      'accounts',
      'windows',
      'retry',
      'rederive',
      'done',
      'cancelled',
      'error',
    ];
    expect(CASES.map(([p]) => p.phase).sort()).toEqual([...phases].sort());
  });
});
