import type { Migration } from '../db.ts';

export const v22: Migration = {
  version: 22,
  name: 'reserve_done',
  // A reserve marked done (read/reserves.ts): when, in epoch seconds; null — active. A done reserve is no longer taken
  // off «Free» / «Available per day» but stays listed.
  statements: [`ALTER TABLE reserves ADD COLUMN done_at INTEGER`],
};
