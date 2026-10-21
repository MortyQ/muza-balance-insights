import type { Migration } from '../db.ts';

export const v09: Migration = {
  version: 9,
  name: 'participant_label_source',
  statements: [
    // 'bank': the label is the holder's name from the bank (updated on every sync); 'user': typed by the user, the
    // bank never changes it. The name is personal data: it stays in this database only.
    `ALTER TABLE participants ADD COLUMN label_source TEXT NOT NULL DEFAULT 'user' CHECK (label_source IN ('user', 'bank'))`,
  ],
};
