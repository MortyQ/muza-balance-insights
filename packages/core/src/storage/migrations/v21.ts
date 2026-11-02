import type { Migration } from '../db.ts';

export const v21: Migration = {
  version: 21,
  name: 'goals.count_taxes',
  // The monthly budget's «count taxes» choice (read/goals.ts): off, «налоги и госплатежи» stays out of the flexible
  // part and cannot be a fixed row. Default 1, so a budget saved before keeps counting them; other plan types ignore it.
  statements: [`ALTER TABLE goals ADD COLUMN count_taxes INTEGER NOT NULL DEFAULT 1 CHECK (count_taxes IN (0, 1))`],
};
