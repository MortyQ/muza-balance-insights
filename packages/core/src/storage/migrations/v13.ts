import type { Migration } from '../db.ts';

export const v13: Migration = {
  version: 13,
  name: 'reserves',
  // Money the user keeps aside from «Available per day» (reserves.ts): a name of their own, so it stays in this
  // database only (the analysis copy takes whitelisted tables only). `until` — the last day it counts; null — no end.
  statements: [
    `CREATE TABLE reserves (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
        currency   INTEGER NOT NULL CHECK (currency IN (980, 840, 978)),
        amount     INTEGER NOT NULL CHECK (amount >= 0),
        until      TEXT CHECK (until IS NULL OR until GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        created_at INTEGER NOT NULL
      )`,
  ],
};
