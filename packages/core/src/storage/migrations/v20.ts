import type { Migration } from '../db.ts';

export const v20: Migration = {
  version: 20,
  name: 'goals, goal_fixed',
  // The user's plans (read/goals.ts): spending limits on a category, the monthly budget, savings goals. One table, as
  // Notion plans it; a CHECK per type. goal_fixed — the monthly budget's own fixed costs, a category and the amount the
  // user typed. A removed person's plans go with them. A savings goal's jar is referred to by its id with no foreign key,
  // so a closed jar leaves the goal readable. Names are the user's text: this database only, never the analysis copy.
  statements: [
    `CREATE TABLE goals (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        type           TEXT NOT NULL CHECK (type IN ('limit', 'budget', 'saving')),
        category       TEXT,
        period         TEXT CHECK (period IS NULL OR period IN ('day', 'week', 'month')),
        currency       INTEGER NOT NULL CHECK (currency IN (980, 840, 978)),
        amount         INTEGER NOT NULL CHECK (amount > 0),
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        name           TEXT CHECK (name IS NULL OR length(name) BETWEEN 1 AND 60),
        until          TEXT CHECK (until IS NULL OR until GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        source         TEXT CHECK (source IS NULL OR source IN ('jar', 'own')),
        account_id     TEXT,
        created_at     INTEGER NOT NULL,
        CHECK (
          (type = 'limit' AND category IS NOT NULL AND period IS NOT NULL AND name IS NULL AND source IS NULL) OR
          (type = 'budget' AND category IS NULL AND period = 'month' AND name IS NULL AND source IS NULL) OR
          (type = 'saving' AND category IS NULL AND period IS NULL AND name IS NOT NULL AND source IS NOT NULL
            AND (source = 'own' OR account_id IS NOT NULL))
        )
      )`,
    `CREATE UNIQUE INDEX goals_one_per_owner ON goals (type, ifnull(category, ''), period, ifnull(participant_id, 0))
       WHERE type IN ('limit', 'budget')`,
    `CREATE TABLE goal_fixed (
        goal_id  INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        amount   INTEGER NOT NULL CHECK (amount > 0),
        PRIMARY KEY (goal_id, category)
      )`,
  ],
};
