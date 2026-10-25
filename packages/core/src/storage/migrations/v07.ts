import type { Migration } from '../db.ts';

export const v07: Migration = {
  version: 7,
  name: 'transactions.scope (personal | business), scope_overrides, settings',
  statements: [
    // Computed by src/derive/scope.ts after categories; 'personal' until the first pass.
    `ALTER TABLE transactions ADD COLUMN scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'business'))`,
    `CREATE INDEX IF NOT EXISTS idx_tx_scope ON transactions (scope)`,
    `CREATE TABLE IF NOT EXISTS scope_overrides (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern    TEXT NOT NULL,   -- matched against counter_name, like category_overrides
        match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'contains')),
        scope      TEXT NOT NULL CHECK (scope IN ('personal', 'business')),
        UNIQUE (pattern, match_type)
      )`,
    // Only non-default values are stored; defaults live in src/people/settings.ts.
    `CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
  ],
};
