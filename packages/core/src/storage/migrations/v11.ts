import type { Migration } from '../db.ts';

export const v11: Migration = {
  version: 11,
  name: 'account_sync_choice',
  // The user's toggle for an account: NULL = auto (accounts.ts), 1 = on, 0 = off. The bank's upsert never touches it.
  statements: [`ALTER TABLE accounts ADD COLUMN sync_choice INTEGER CHECK (sync_choice IN (0, 1))`],
};
