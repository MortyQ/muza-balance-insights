import type { Migration } from '../db.ts';

export const v24: Migration = {
  version: 24,
  name: 'goal_excluded',
  // The monthly budget's exclusions (read/goals.ts): a category the budget counts neither as flexible spending nor as a
  // fixed row. Like goal_fixed, a budget's own rows, gone with it. «Count taxes» off (v21) becomes one of them: every
  // budget saved with it off gets a taxes row. goals.count_taxes stays in the schema, written as 1 and never read —
  // dropping a column with a CHECK would be a third rebuild of goals. The word is the category's (derive/categories.ts,
  // `taxes`), repeated here as a migration must not depend on code that can change.
  statements: [
    `CREATE TABLE goal_excluded (
        goal_id  INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        PRIMARY KEY (goal_id, category)
      )`,
    `INSERT INTO goal_excluded (goal_id, category)
        SELECT id, 'налоги и госплатежи' FROM goals WHERE type = 'budget' AND count_taxes = 0
          AND NOT EXISTS (SELECT 1 FROM goal_fixed f WHERE f.goal_id = goals.id AND f.category = 'налоги и госплатежи')`,
  ],
};
