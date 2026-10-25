import type { Migration } from '../db.ts';

export const v02: Migration = {
  version: 2,
  name: 'transactions.is_cancelled (soft-delete for holds that disappeared from the API)',
  statements: [
    // 1 = was hold=1 and the API stopped returning it on a re-fetch of the same window.
    // Every query must filter is_cancelled = 0. A later re-appearance resets it to 0 (upsert).
    `ALTER TABLE transactions ADD COLUMN is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK (is_cancelled IN (0, 1))`,
  ],
};
