import type { Migration } from '../db.ts';

export const v12: Migration = {
  version: 12,
  name: 'recurring_marks',
  // The user's marks on a regular payment (recurring.ts), by payee: the key holds the bank's text or the account paid
  // to, so it stays in this database only (the analysis copy takes whitelisted tables only).
  statements: [
    `CREATE TABLE recurring_marks (
        payee      TEXT PRIMARY KEY,
        mark       TEXT NOT NULL CHECK (mark IN ('mandatory', 'hidden')),
        updated_at INTEGER NOT NULL
      )`,
  ],
};
