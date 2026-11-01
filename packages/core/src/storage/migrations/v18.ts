import type { Migration } from '../db.ts';

export const v18: Migration = {
  version: 18,
  name: 'manual_categories, payee_categories',
  // The user's own category choices, kept apart from transactions so no import or re-derivation ever writes them.
  // manual_categories: one operation, by its stored id (stable across re-uploads; no foreign key, so a row that comes
  // back keeps its choice). payee_categories: every debit of one payee — `key` is the counter_name (field
  // 'counter_name') or, without one, the description ('description'), trimmed and lower-cased.
  // Both hold bank text by reference or by value: this database only, never the analysis copy.
  statements: [
    `CREATE TABLE IF NOT EXISTS manual_categories (
        transaction_id TEXT PRIMARY KEY,
        category       TEXT NOT NULL,
        set_at         INTEGER NOT NULL
      )`,
    `CREATE TABLE IF NOT EXISTS payee_categories (
        field    TEXT NOT NULL CHECK (field IN ('counter_name', 'description')),
        key      TEXT NOT NULL,
        category TEXT NOT NULL,
        set_at   INTEGER NOT NULL,
        PRIMARY KEY (field, key)
      )`,
  ],
};
