import type { Migration } from '../db.ts';

export const v19: Migration = {
  version: 19,
  name: 'category_kinds',
  // The user's own kind of a spending category (read/category-kinds.ts): a row only for a category changed from its
  // default, deleted on reset. Kept apart from transactions, so no import or re-derivation ever writes it; this
  // database only, never the analysis copy.
  statements: [
    `CREATE TABLE IF NOT EXISTS category_kinds (
        category TEXT PRIMARY KEY,
        kind     TEXT NOT NULL CHECK (kind IN ('essential', 'wants', 'savings')),
        fixed    INTEGER NOT NULL CHECK (fixed IN (0, 1)),
        set_at   INTEGER NOT NULL
      )`,
  ],
};
