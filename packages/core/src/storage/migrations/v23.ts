import type { Migration } from '../db.ts';

export const v23: Migration = {
  version: 23,
  name: 'reserves, goals: currency CHECK += 203',
  // The currencies of reserves and plans are the app's one list (APP_CURRENCIES, shared/currency.ts): koruna joins
  // them. The tables keep their own CHECK as a second guard, so it takes the list as it is now (a new currency there
  // needs a rebuild like this one; tests/storage/currency-check.test.ts fails until then). A CHECK can't change in
  // place → both tables are rebuilt as they are. foreign_keys is ON: goals is renamed away first (goal_fixed's reference
  // follows it), goal_fixed is rebuilt against the new goals, then the old ones are dropped; the AUTOINCREMENT counters
  // carry over, so a deleted id is never reused.
  statements: [
    `ALTER TABLE reserves RENAME TO reserves_old`,
    `CREATE TABLE reserves (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        name           TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
        currency       INTEGER NOT NULL CHECK (currency IN (980, 840, 978, 203)),
        amount         INTEGER NOT NULL CHECK (amount >= 0),
        until          TEXT CHECK (until IS NULL OR until GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        created_at     INTEGER NOT NULL,
        participant_id INTEGER REFERENCES participants(id) ON DELETE SET NULL,
        done_at        INTEGER
      )`,
    `INSERT INTO reserves (id, name, currency, amount, until, created_at, participant_id, done_at)
        SELECT id, name, currency, amount, until, created_at, participant_id, done_at FROM reserves_old`,
    `INSERT INTO sqlite_sequence (name, seq) SELECT 'reserves', seq FROM sqlite_sequence WHERE name = 'reserves_old'
        AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'reserves')`,
    `UPDATE sqlite_sequence SET seq = max(seq, (SELECT seq FROM sqlite_sequence WHERE name = 'reserves_old'))
        WHERE name = 'reserves' AND EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'reserves_old')`,
    `DROP TABLE reserves_old`,

    `ALTER TABLE goals RENAME TO goals_old`,
    `CREATE TABLE goals (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        type           TEXT NOT NULL CHECK (type IN ('limit', 'budget', 'saving')),
        category       TEXT,
        period         TEXT CHECK (period IS NULL OR period IN ('day', 'week', 'month')),
        currency       INTEGER NOT NULL CHECK (currency IN (980, 840, 978, 203)),
        amount         INTEGER NOT NULL CHECK (amount > 0),
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        name           TEXT CHECK (name IS NULL OR length(name) BETWEEN 1 AND 60),
        until          TEXT CHECK (until IS NULL OR until GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        source         TEXT CHECK (source IS NULL OR source IN ('jar', 'own')),
        account_id     TEXT,
        created_at     INTEGER NOT NULL,
        count_taxes    INTEGER NOT NULL DEFAULT 1 CHECK (count_taxes IN (0, 1)),
        CHECK (
          (type = 'limit' AND category IS NOT NULL AND period IS NOT NULL AND name IS NULL AND source IS NULL) OR
          (type = 'budget' AND category IS NULL AND period = 'month' AND name IS NULL AND source IS NULL) OR
          (type = 'saving' AND category IS NULL AND period IS NULL AND name IS NOT NULL AND source IS NOT NULL
            AND (source = 'own' OR account_id IS NOT NULL))
        )
      )`,
    `INSERT INTO goals (id, type, category, period, currency, amount, participant_id, name, until, source, account_id,
        created_at, count_taxes)
        SELECT id, type, category, period, currency, amount, participant_id, name, until, source, account_id,
          created_at, count_taxes FROM goals_old`,
    `INSERT INTO sqlite_sequence (name, seq) SELECT 'goals', seq FROM sqlite_sequence WHERE name = 'goals_old'
        AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'goals')`,
    `UPDATE sqlite_sequence SET seq = max(seq, (SELECT seq FROM sqlite_sequence WHERE name = 'goals_old'))
        WHERE name = 'goals' AND EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'goals_old')`,
    `ALTER TABLE goal_fixed RENAME TO goal_fixed_old`,
    `CREATE TABLE goal_fixed (
        goal_id  INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        amount   INTEGER NOT NULL CHECK (amount > 0),
        PRIMARY KEY (goal_id, category)
      )`,
    `INSERT INTO goal_fixed (goal_id, category, amount) SELECT goal_id, category, amount FROM goal_fixed_old`,
    `DROP TABLE goal_fixed_old`,
    `DROP TABLE goals_old`,
    `CREATE UNIQUE INDEX goals_one_per_owner ON goals (type, ifnull(category, ''), period, ifnull(participant_id, 0))
       WHERE type IN ('limit', 'budget')`,
  ],
};
